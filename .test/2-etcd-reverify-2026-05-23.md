# Slot 18 lesson 2 etcd strong consensus — re-verify 2026-05-23

Flow 1 cluster-info: PASS — 200, memberCount=1, member name etcd0.
Flow 2 join-queue (alice/bob/carol): PASS — three 201s, createRevisions 2/3/4, positions 0/1/2, isMyTurn correct.
Flow 3 queue-state: PASS — 200, length=3, head=alice@rev2, entries in order.
Flow 4 raft-demo: PASS — 200, wrote+readBack consensus-write, elapsedMs=21.

4/4 PASS, 0 retries.
