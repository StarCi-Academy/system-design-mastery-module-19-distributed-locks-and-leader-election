# Slot 18 lesson 1 lease-based leader election — re-verify 2026-05-23

Flow 1 identify leader: PASS — 200 on 3026/3027/3028; exactly one iAmLeader=true (80cbb63e05b6-1 on 3026), term=1, two followers point to same currentLeader.
Flow 2 leader-only work: PASS — 200 on 3026; recentWork array contains multiple "LEADER … did work (term 1)" entries.
Flow 3 failover after crash: PASS — simulate-crash 201 wasLeader=true; after 5s new leader emerged (877e308c124b-1 on 3027) iAmLeader=true; old leader stepped down to follower pointing at new leader.

3/3 PASS, 0 retries.
