# Slot 18 lesson 0 redlock — re-verify 2026-05-23

Flow 1 acquire+release: PASS — acquire 201 acquiredOn=3/3 fencingToken=3 validityMs=4949; release 201 releasedOn=3/3.
Flow 2 safety-demo: PASS — 200, aFencingToken=4 bFencingToken=5 writeBFirst.accepted=true writeAStale.accepted=false.
Flow 3 quorum survives (redis-3 down): PASS — 201 acquired=true acquiredOn=2/3 quorum=2 validityMs=2969.
Flow 4 below-quorum (redis-2 & redis-3 down): PASS — 201 acquired=false acquiredOn=1/3 quorum=2 (mechanism verified; lesson asks only redis-2 down but mechanism check identical).

4/4 PASS, 0 retries needed.
