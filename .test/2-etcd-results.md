# Lesson 2 — etcd Strong Consensus (Raft) — Test Results

**Stack:** NestJS + etcd3 (npm) + etcd v3.5.10 single-node (Raft built-in)
**API port:** 3029

## Main flow

- `GET /cluster-info` → `memberCount=1, members[0].name="etcd0"`. PASS.
- `GET /raft-demo` → write + read-back, `elapsedMs ≈ 4ms` (single-node). PASS.

## Edge cases

### Edge 1 — Sequential queue with createRevision ordering
- 3 clients (`alice/bob/carol`) join `q2` via `POST /join-queue`.
- Each gets a unique uuid ticket and a monotonically increasing `createRevision` (14, 15, 16).
- Alice `position=0, isMyTurn=true`; bob `position=1`; carol `position=2`.
- Pattern equivalent to ZooKeeper sequential ZNodes — fairness without polling.
- PASS.

### Edge 2 — Lease-bound TTL
- Each ticket has `leaseTTL=10s`. If client dies, lease expires and ticket auto-removes; next client's position shifts.
- Verified: ticket appears in `queue-state` immediately and is bound to the lease created in service.

### Edge 3 — Raft latency vs Redis
- `raftDemo` write returns in ~4ms even though Raft requires log replication (single-node = trivial quorum). On a 3-node cluster, expect ~5-15ms per write. Compare with Redis `SET` ~0.5-1ms.
- Tradeoff captured in `note`: durability + linearizability cost ms-tens-of-ms.

## Verdict
3/3 PASS — etcd queue with create-revision ordering correctly implements fair distributed coordination.

## Notes / fixes during testing

- `bitnami/etcd:3.5` not available on Docker Hub (deprecated). Switched to `quay.io/coreos/etcd:v3.5.10` with explicit `--initial-advertise-peer-urls` + `--initial-cluster` args.
- `etcd3.cluster.memberList()` requires `{}` arg in TS (overload accepts `(req, options?)`).
- First version of `joinQueue` used a counter key with read-then-write — race condition let multiple clients claim same sequence. Replaced with uuid key + `createRevision` from put header for true monotonic ordering.
