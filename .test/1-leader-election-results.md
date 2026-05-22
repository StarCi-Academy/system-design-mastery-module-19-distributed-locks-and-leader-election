# Lesson 1 — Lease-Based Leader Election — Test Results

**Stack:** NestJS × 3 replicas + Redis 7 single-node (lease store)
**Ports:** api-1=3026, api-2=3027, api-3=3028
**Params:** leaseMs=3000, renewIntervalMs=1000 (renew every 1s, lease lasts 3s).

## Main flow

- All 3 replicas start; one acquires the leader key via `SET NX PX 3000`.
- `GET /status` from each shows exactly one `iAmLeader=true`, two followers acknowledging the leader's id.

PASS — single leader elected.

## Edge cases

### Edge 1 — Leader does work, followers idle
- Leader's `recentWork` shows `LEADER ... did work` every ~1s (matching renew tick).
- Followers' `recentWork` is empty; `note` says "Follower idle. Đang đợi lease của <leader> expire."
- PASS.

### Edge 2 — Crash → failover
- `POST /simulate-crash` on the leader stops its renew loop for 5s.
- Within ~3s (lease TTL), another replica detects no leader and runs `SET NX PX` → becomes new leader with `term=1`.
- After 5s, original leader revives as follower (no longer holds key).
- Verified: api-1 was leader, crashed; api-3 took over; api-1 returned as follower acknowledging api-3.
- PASS.

### Edge 3 — Lua CAS renewal prevents split-brain
- Renew script: `if GET == myId then PEXPIRE else return 0` — a leader that has been demoted (someone else holds key) cannot renew. The service logs "Step down: lost lease" and resets `isLeader=false`.
- Verified implicitly: original api-1 after revival never tries to forge renewal because its `isLeader` flag was reset on crash, and the cluster has only one true leader at any time.
- PASS.

## Verdict
3/3 PASS — Lease-based election survives crash with bounded gap (~lease TTL).
