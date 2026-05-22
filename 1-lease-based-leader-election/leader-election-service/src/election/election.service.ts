import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { hostname } from "node:os"
import Redis from "ioredis"

const LUA_RENEW = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
    redis.call("PEXPIRE", KEYS[1], ARGV[2])
    return 1
else
    return 0
end
`

@Injectable()
export class ElectionService implements OnModuleInit, OnModuleDestroy {
    private redis!: Redis
    private readonly nodeId = `${hostname()}-${process.pid}`
    private readonly leaderKey = "election:leader"
    private readonly leaseMs = 3000
    private readonly renewIntervalMs = 1000
    private isLeader = false
    private term = 0
    private renewedAt: number | null = null
    private renewTimer?: NodeJS.Timeout
    private renewSha!: string
    private readonly log = new Logger(ElectionService.name)
    private workEvents: string[] = []

    constructor(private readonly config: ConfigService) {}

    async onModuleInit(): Promise<void> {
        this.redis = new Redis({
            host: this.config.get<string>("REDIS_HOST") ?? "redis",
            port: Number(this.config.get<string>("REDIS_PORT")) || 6379,
        })
        this.renewSha = await this.redis.script("LOAD", LUA_RENEW) as string
        this.renewTimer = setInterval(() => void this.tick(), this.renewIntervalMs)
    }

    async onModuleDestroy(): Promise<void> {
        if (this.renewTimer) clearInterval(this.renewTimer)
        if (this.isLeader) {
            await this.redis.eval(`if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end`,
                1, this.leaderKey, this.nodeId).catch(() => 0)
        }
        await this.redis?.quit()
    }

    private async tick(): Promise<void> {
        if (this.isLeader) {
            const renewed = await this.redis.evalsha(
                this.renewSha, 1, this.leaderKey, this.nodeId, this.leaseMs.toString(),
            ).catch(() => 0)
            if (Number(renewed) === 1) {
                this.renewedAt = Date.now()
                this.workEvents.push(`[${new Date().toISOString()}] LEADER ${this.nodeId} did work (term ${this.term})`)
                if (this.workEvents.length > 20) this.workEvents.shift()
            } else {
                this.log.warn(`Step down: lost lease as ${this.nodeId}`)
                this.isLeader = false
                this.workEvents.push(`[${new Date().toISOString()}] ${this.nodeId} STEPPED DOWN (lease lost)`)
            }
            return
        }
        const acquired = await this.redis.set(this.leaderKey, this.nodeId, "PX", this.leaseMs, "NX")
        if (acquired === "OK") {
            this.isLeader = true
            this.term += 1
            this.renewedAt = Date.now()
            this.workEvents.push(`[${new Date().toISOString()}] ${this.nodeId} ELECTED leader (term ${this.term})`)
            this.log.log(`Elected: ${this.nodeId} term=${this.term}`)
        }
    }

    async status() {
        const currentLeader = await this.redis.get(this.leaderKey)
        const pttl = await this.redis.pttl(this.leaderKey)
        return {
            myId: this.nodeId,
            iAmLeader: this.isLeader,
            currentLeader,
            leaseRemainingMs: pttl,
            lastRenewedAt: this.renewedAt ? new Date(this.renewedAt).toISOString() : null,
            term: this.term,
            recentWork: this.workEvents.slice(-5),
            note: this.isLeader
                ? "Tôi đang là leader — đang renew lease mỗi 1s, lease 3s."
                : currentLeader
                    ? `Follower idle. Đang đợi lease của ${currentLeader} expire.`
                    : "Không có leader. Sẽ thử acquire ở tick kế.",
        }
    }

    async simulateCrash() {
        const wasLeader = this.isLeader
        this.isLeader = false
        if (this.renewTimer) {
            clearInterval(this.renewTimer)
            this.renewTimer = undefined
        }
        this.workEvents.push(`[${new Date().toISOString()}] ${this.nodeId} SIMULATED CRASH`)
        setTimeout(() => {
            this.renewTimer = setInterval(() => void this.tick(), this.renewIntervalMs)
            this.workEvents.push(`[${new Date().toISOString()}] ${this.nodeId} REVIVED`)
        }, 5000)
        return {
            simulated: true,
            wasLeader,
            nodeId: this.nodeId,
            note: "Renew loop bị tắt 5s. Replica khác sẽ chiếm leader sau khi lease (3s) expire. Sau 5s ta hồi sinh thành follower.",
        }
    }
}
