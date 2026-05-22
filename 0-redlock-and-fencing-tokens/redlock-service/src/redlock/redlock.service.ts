import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { randomUUID } from "node:crypto"
import Redis from "ioredis"

const LUA_RELEASE = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
else
    return 0
end
`

@Injectable()
export class RedlockService implements OnModuleInit, OnModuleDestroy {
    private nodes: Redis[] = []
    private fencingCounter = 0

    constructor(private readonly config: ConfigService) {}

    async onModuleInit(): Promise<void> {
        const raw = this.config.get<string>("REDIS_NODES")
            ?? "redis-1:6379,redis-2:6379,redis-3:6379"
        this.nodes = raw.split(",").map((e) => {
            const [host, port] = e.trim().split(":")
            return new Redis({
                host, port: Number(port) || 6379,
                lazyConnect: false,
                connectTimeout: 500,
                commandTimeout: 500,
                maxRetriesPerRequest: 1,
                enableOfflineQueue: false,
            })
        })
    }

    async onModuleDestroy(): Promise<void> {
        await Promise.all(this.nodes.map((n) => n.quit()))
    }

    async acquire(resource: string, ttlMs: number) {
        const token = randomUUID()
        const key = `lock:${resource}`
        const start = Date.now()
        const quorum = Math.floor(this.nodes.length / 2) + 1

        const results = await Promise.all(this.nodes.map(async (n) => {
            try {
                const r = await n.set(key, token, "PX", ttlMs, "NX")
                return r === "OK"
            } catch {
                return false
            }
        }))
        const acquiredCount = results.filter(Boolean).length
        const elapsed = Date.now() - start
        const validityMs = ttlMs - elapsed - Math.floor(ttlMs * 0.01)

        if (acquiredCount >= quorum && validityMs > 0) {
            this.fencingCounter += 1
            return {
                acquired: true,
                token,
                fencingToken: this.fencingCounter,
                acquiredOn: acquiredCount,
                totalNodes: this.nodes.length,
                quorum,
                validityMs,
                note: `Quorum đạt được trên ${acquiredCount}/${this.nodes.length} node. Fencing token là số đơn điệu tăng — server downstream phải reject token cũ.`,
            }
        }

        await Promise.all(this.nodes.map((n) => n.eval(LUA_RELEASE, 1, key, token).catch(() => 0)))
        return {
            acquired: false,
            acquiredOn: acquiredCount,
            totalNodes: this.nodes.length,
            quorum,
            elapsedMs: elapsed,
            note: `Không đủ quorum (cần ${quorum}, có ${acquiredCount}) hoặc TTL hết trong lúc acquire — đã rollback các lock đã nắm.`,
        }
    }

    async release(resource: string, token: string) {
        const key = `lock:${resource}`
        const results = await Promise.all(this.nodes.map(async (n) => {
            const r = await n.eval(LUA_RELEASE, 1, key, token).catch(() => 0)
            return Number(r) === 1
        }))
        return {
            released: true,
            releasedOn: results.filter(Boolean).length,
            totalNodes: this.nodes.length,
            note: "Release dùng Lua CAS: chỉ DEL nếu value vẫn là token mình nắm.",
        }
    }

    private fencingStore = new Map<string, number>()

    write(resource: string, fencingToken: number, value: string) {
        const last = this.fencingStore.get(resource) ?? 0
        if (fencingToken <= last) {
            return {
                accepted: false,
                resource,
                yourFencingToken: fencingToken,
                lastSeen: last,
                note: "Storage REJECT fencing token cũ hơn (stale client từng pause, lock đã expire, leader mới đã write). Đây là core của paper Martin Kleppmann.",
            }
        }
        this.fencingStore.set(resource, fencingToken)
        return {
            accepted: true,
            resource,
            value,
            fencingToken,
            note: "Write hợp lệ — storage ghi nhớ fencingToken làm watermark cho lần sau.",
        }
    }

    async safetyDemo(resource: string) {
        const a = await this.acquire(resource, 2000)
        if (!a.acquired) return { error: "Acquire 1 fail", a }
        const aFence = (a as any).fencingToken
        const aToken = (a as any).token

        await new Promise((r) => setTimeout(r, 2200))

        const b = await this.acquire(resource, 2000)
        const bFence = (b as any).fencingToken

        const writeB = this.write(resource, bFence, "value-from-B")
        const writeA = this.write(resource, aFence, "value-from-A")

        await this.release(resource, aToken).catch(() => undefined)
        if ((b as any).token) await this.release(resource, (b as any).token).catch(() => undefined)

        return {
            scenario: "Client A acquire → pause vượt TTL → Client B acquire → B ghi trước → A (stale) thử ghi sau và phải bị reject.",
            aFencingToken: aFence,
            bFencingToken: bFence,
            writeBFirst: writeB,
            writeAStale: writeA,
            safetyVerdict: writeB.accepted === true && writeA.accepted === false
                ? "PASS — B accept (fencingToken mới = " + bFence + "), A reject vì stale (fencingToken cũ = " + aFence + " < " + bFence + "). Fencing token cứu safety."
                : "FAIL — phải xem lại logic.",
        }
    }
}
