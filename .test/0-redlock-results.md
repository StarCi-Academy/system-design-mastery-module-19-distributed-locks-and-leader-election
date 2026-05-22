# Lesson 0 — Redlock + Fencing Tokens — Test Results

**Stack:** NestJS + ioredis × 3 Redis 7 nodes (independent, no replication)
**API port:** 3025

## Main flow
- `POST /acquire` resource=job_x, ttl=5s → `acquired=true, acquiredOn=3/3, fencingToken=N, validityMs ≈ ttl - drift`.
- `POST /acquire` same resource immediately → `acquired=false, acquiredOn=0` (lock held).
- `POST /write` with fresh fencing → `accepted=true`.
- `POST /write` with stale fencing=1 → `accepted=false, lastSeen=N`.
- `POST /release` with token → `released=true, releasedOn=3/3`.

PASS.

## Edge cases

### Edge 1 — Safety demo (Martin Kleppmann scenario)
- `GET /safety-demo` runs full sequence: A acquire → A pause >TTL → B acquire → B writes (fresh fence) → A wakes up and writes (stale fence).
- Result: `writeBFirst.accepted=true (fence=4)`, `writeAStale.accepted=false (fence=3 < 4)`, `safetyVerdict=PASS`.
- Verifies that **mutex alone is unsafe** without fencing tokens — paper's central point.

### Edge 2 — Quorum survives N-1 node down
- Kill `redis-3`. Acquire → `acquired=true, acquiredOn=2/3`. Quorum (2) met. PASS.

### Edge 3 — Below quorum → safe denial
- Kill `redis-2` as well. Acquire → `acquired=false, acquiredOn=1/3, elapsedMs=0`. Limiter fails closed. PASS.

### Edge 4 — Network timeout doesn't hang lock
- `commandTimeout: 500ms` per node prevents one slow/dead node from blocking the entire acquire. Before fix, dead node caused 80s+ hang; after fix, acquire returns within ~500ms even with dead nodes.

## Verdict
4/4 PASS — Redlock with fencing tokens demonstrates both liveness (quorum-of-N) and safety (fencing).
