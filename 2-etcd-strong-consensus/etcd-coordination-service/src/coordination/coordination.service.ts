import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { Etcd3, Lease } from "etcd3"

@Injectable()
export class CoordinationService implements OnModuleInit, OnModuleDestroy {
    private etcd!: Etcd3
    private leases = new Map<string, Lease>()

    constructor(private readonly config: ConfigService) {}

    async onModuleInit(): Promise<void> {
        const hosts = (this.config.get<string>("ETCD_HOSTS") ?? "etcd:2379").split(",")
        this.etcd = new Etcd3({ hosts })
    }

    async onModuleDestroy(): Promise<void> {
        for (const lease of this.leases.values()) {
            try { await lease.revoke() } catch { /* ignore */ }
        }
    }

    async clusterInfo() {
        const members = await this.etcd.cluster.memberList({})
        return {
            memberCount: members.members.length,
            members: members.members.map((m) => ({
                id: m.ID.toString(),
                name: m.name,
                peerURLs: m.peerURLs,
            })),
            note: "etcd dùng Raft consensus — majority quorum, strong consistency. Khác Redis: write chỉ thành công khi log replicate xong sang đa số node.",
        }
    }

    async joinQueue(queueName: string, clientId: string) {
        const lease = this.etcd.lease(10)
        const grant = await lease.grant()
        const prefix = `/queue/${queueName}/`

        const { randomUUID } = await import("node:crypto")
        const uniqueId = randomUUID()
        const ticketKey = `${prefix}${uniqueId}`

        const putRes = await (this.etcd.put(ticketKey).value(clientId).lease(grant) as any).exec()
        const myCreateRevision = Number(putRes.header.revision)
        this.leases.set(`${queueName}:${clientId}:${uniqueId}`, lease)

        const entries = await this.etcd.getAll().prefix(prefix).sort("Create", "Ascend").exec()
        const sorted = entries.kvs.map((kv: any) => ({
            key: kv.key.toString(),
            value: kv.value.toString(),
            createRevision: Number(kv.create_revision),
        }))
        const position = sorted.findIndex((e: any) => e.key === ticketKey)
        const isMyTurn = position === 0
        return {
            queueName,
            clientId,
            ticketKey,
            createRevision: myCreateRevision,
            position,
            isMyTurn,
            leaseTTL: 10,
            note: isMyTurn
                ? "Tới lượt bạn — sequential ZNode đầu tiên trong queue. Job/lock được giải phóng khi lease revoke."
                : `Bạn đứng thứ ${position} — watch ticket trước bạn, tự thức khi nó biến mất (revoke hoặc TTL hết). Đây là pattern fair lock của etcd/ZooKeeper.`,
        }
    }

    async queueState(queueName: string) {
        const prefix = `/queue/${queueName}/`
        const res = await this.etcd.getAll().prefix(prefix).sort("Create", "Ascend").exec()
        const entries = res.kvs.map((kv: any) => ({
            key: kv.key.toString(),
            clientId: kv.value.toString(),
            createRevision: Number(kv.create_revision),
        }))
        return {
            queueName,
            length: entries.length,
            head: entries[0] ?? null,
            entries,
            note: entries.length > 0
                ? `Head là client tới lượt. Khi head leave (revoke lease), position của mọi người dịch xuống 1.`
                : "Queue rỗng.",
        }
    }

    async raftDemo() {
        const key = `/raft-demo/${Date.now()}`
        const value = "consensus-write"
        const start = Date.now()
        await this.etcd.put(key).value(value)
        const elapsed = Date.now() - start
        const readBack = await this.etcd.get(key).string()
        return {
            wrote: { key, value },
            readBack,
            elapsedMs: elapsed,
            note: "Write này đã được Raft replicate sang majority node trước khi return. Latency cao hơn Redis (~ms-tens-of-ms vì cần ack từ peer), đổi lại durability + linearizability.",
        }
    }
}
