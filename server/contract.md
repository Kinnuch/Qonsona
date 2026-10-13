# Shared accounts and collection API v1

All routes use `/v1`. JSON UTF-8, body <=32KiB, errors `{error:{code,message}}` with stable English `code`; successful data are returned directly (no `data` wrapper). Authentication uses `Authorization: Bearer <opaque token>` held by the desktop main process. Production clients must use the configured HTTPS origin; never forward a bearer to another origin or allow invalid certificates. Server listens on loopback behind TLS nginx in production. No browser CORS/API credentials are shipped.

## Identity and snapshot

`POST /auth/register {username,password,nickname?}` and `/auth/login {username,password}` return `{token,expiresAt,user,snapshot}`. User: `{id,username,nickname,publicId,publicCollection,publicTime,createdAt}`. Username is case-insensitive ASCII `[a-z0-9_]{3,32}`, password 10–128 chars. Username is private; public rankings show nickname and random publicId. `POST /auth/logout {}` revokes this session. `GET /auth/me` returns `{user,snapshot}`. `PATCH /auth/me {nickname?,publicCollection?,publicTime?}` changes only supplied fields. Both public flags default false.

`GET /collection` returns snapshot:

```
{version:1,revision,serverTime,day,user,balances:{points,tickets:{learning,support},echoes},
 pity:{sinceSSR,sinceHigh},
 characters:[{id,count,firstAt,source}],legacy:[{id,day,at,minutes}],inventory:{makeup,decorations:string[]},
 checkins:[{day,kind:'learning'|'makeup'}],
 today:{seconds,timePoints,taskPoints,tasks,taskPlan:[{id,kind,done,reward:20}],planChanges,weeklyBonus},
 totals:{seconds,collectionCount},catalog:[{id,tier,sheet,cell,name:{zh,en}}],
 shop:[{id,price,currency:'points'|'echoes',type,characterId?}],drawRules:{...},
 history:[{id,kind,at,detail}]}
```

Characters use `companion-1`…`companion-12`, current two 3×2 sprite sheets; tiers A/R/SR/SSR each have three test characters. These are server test catalog IDs, not automatic migration of local legacy collectibles. All dates and weekly boundaries use Asia/Shanghai (UTC+08); week starts Monday. Online paid/economy state is never restored by client JSON import.

## Learning, shop, draw

`POST /reward/activity {requestId,language,seconds,completion?:{kind,id}}`: seconds integer 0–60; language one of ja/en/fr/ko/es/ar/ru/gd/qya/sjn or `qonlang:<stable-pack-id>`. Kinds reading/practice/courses/review. `requestId` globally unique per account and mutation family; replays return the original response, mismatched payload returns IDEMPOTENCY_CONFLICT. Heartbeat is bounded by server elapsed time since previous activity across all devices (first heartbeat initializes clock and earns no time). Daily accepted time <=7200s, time reward 2 points/min <=120; Three daily goals earn20 each, max60: any genuine completion plus the two designated kinds (default reading and review). One reading completion satisfies any+reading for40; further readings cannot substitute for review. today.tasks remains the numeric distinct-event count. First true completion checks in. At least five different actual days in a Monday–Sunday week, each with >=600 seconds and >=1 completion, earn80 once; makeup does not count toward weekly bonus. Client event claims cannot be cryptographically proven; this is bounded accounting, not a claim of cheat-proof learning verification.

`POST /shop/purchase {requestId,itemId,quantity?}`: `ticket` (240 points → one learning ticket), `makeup` (80 points), `character:<A-id>` (240), `character:<R-id>` (720). Max quantity 10. `POST /draw {requestId,source:'learning'|'support',count:1|10}` returns `{results:[{id,tier,duplicate,echoes}],snapshot}`. Only the selected source is spent, and both sources share the same pair of pity counters. Base A70/R24.4/SR5/SSR0.6%; high-tier (SR/SSR) guaranteed at 20; SSR draw76 is5.6%, rises5 percentage points per draw until draw89=70.6%, draw90=100%. SSR check precedes high pity; non-SSR weights use70:24.4:5 normalized, or SR-only on high guarantee. SSR resets both counters, SR resets high counter. Duplicate echoes A1/R3/SR8/SSR20; cosmetic only, not cash, transferable credit or draw tickets.

`POST /inventory/use {requestId,itemId:'makeup',day}` consumes one item, only yesterday through7days ago, <=2 uses per calendar month, only unchecked day. Creates makeup checkin only; never changes actual seconds/task totals or weekly learning bonus. `GET /leaderboards?kind=collection|time&language=<id>&limit=20`: collection ignores optional language (global catalog); time without language shows all-language total; supplied language is exact-matched. Returns `{kind,language,rows:[{rank,publicId,nickname,value}]}` using opt-in flags; no username/payment data. Seconds are server-capped lifetime accepted per-language totals.

## Manual support, administration, isolated tests

`POST /support/orders {requestId,tickets}` creates a pending manual-verification order (1–100 tickets, server price `QON_SUPPORT_TICKET_FEN`, default600fen), returns `{order:{id,tickets,amountFen,currency:'CNY',status,testing,createdAt,approvedAt},snapshot}`. The6000fen monthly cap limits the actual quantity. `GET /support/orders` returns `{orders}` for this account. Production rejects order creation/approval unless `QON_PAYMENTS_ENABLED=1` (default0). Nonproduction with payments disabled creates simulation-only orders with `testing:true`; UI must not ask for real payment or show a real payment QR. A QR/screenshot/client payment button never grants credit. Authorized operator must independently verify receipt and adulthood.

Admin routes use a separate `Authorization: Bearer <QON_ADMIN_KEY>`, never shipped to clients. `GET /admin/support/orders?status=pending`; `POST /admin/support/orders/:id/approve {requestId,paymentReference,amountFen,adultVerified:true}` must match expected amount; actual transaction reference unique across orders. The administrator's flag records independent verification, not a claim that a checkbox proves age. Simulation reference must start `QA-`; switching modes cannot approve an old testing order as real. Credits support tickets exactly once. `POST .../reject {requestId}`; `POST .../refund {requestId}` only succeeds before any support draw or spend on that order's credited balance (conservative account-level consumed check); payment refund must be performed separately by operator, this endpoint records confirmed refund and reverses credit. Disputed/already-consumed refunds require documented manual handling; do not silently erase collections.

`POST /test/grant {}`: 100 learning tickets once per account per `QON_TEST_EPOCH`; allowed only `NODE_ENV !== production && QON_TEST_GRANTS=1`, with normal account auth. Always404 in production. This is not an admin credential or a frontend permission shortcut.

All economic mutations transact SQLite ledger+balances+idempotency response atomically. Unknown properties rejected. No client balance, probability, pity or paid history upload endpoint. Legacy memorial migration below accepts only bounded personal decorations.

`GET /health` (no authentication): `{status:'ok',testing:{grantsEnabled:boolean},payments:{enabled:boolean,simulation:boolean}}`. GrantsEnabled is alwaysfalse in production. Support orders have a6000fen/month cap (pending plus approved count, rejected/refunded do not). Snapshot.history is the latest50 server ledger records, private to owner. `revision:number` strictly increases on each committed mutation/profile edit, even in the same millisecond; clients reject lower revisions. Idempotent replay returns the original response/revision. Completion-only seconds0does not advance the heartbeat clock, except first initialization. All timestamp fields are Unix milliseconds, not seconds or ISO strings. `today.tasks` is a number of unique completed events. Shop types are ticket/makeup/character/decoration. `drawRules` exact fields are exported in server/domain.mjs RULES. Nickname1–40trim; usernames ASCII case-insensitive; session expiry30days. Optional `X-Qon-App:qonlang|qonsona` selects session product only. Mutations return `{snapshot,...route-specific-result}`.

## Daily designated plan and old memorials

`POST /tasks/configure {requestId,kinds:[kind,kind]}`: exactly two distinct reading/practice/courses/review kinds. Once per Asia/Shanghai day, before accepted learning seconds or any completion/reward. Returns `{kinds,snapshot}`. Same request replay is idempotent; another change returns TASK_PLAN_CHANGE_LIMIT, learning begun returns TASK_PLAN_LOCKED, invalid kinds return INVALID_TASK_PLAN. today.planChanges is0 or1. today.taskPlan uses stable IDs any/board-1/board-2 and kind/done/reward20. Done derives from stored completion keys. Historical task points are preserved without awards exceeding60. Weekly qualification remains five days with at least600 accepted seconds and any genuine completion, independent of designated boards.

`POST /collection/legacy {requestId,unlocks:[{id,day,at,minutes}]}` requires login. Only companion-1 through companion-12, at most12 distinct IDs per batch. minutes is numeric5/15/30; day is valid nonfuture YYYY-MM-DD and at is nonnegative nonfuture integer Unix milliseconds. Original local timezone may differ; day and at need not map to the same Shanghai day. Unknown fields rejected. Returns `{imported,snapshot}`; imported counts submitted records, not economic grants. Merge by ID preserves earliest timestamp across sessions/devices. snapshot.legacy defaults to[] for old accounts. Errors INVALID_LEGACY/INVALID_LEGACY_ENTRY/INVALID_LEGACY_DATE or generic INVALID_FIELDS/INVALID_BODY.

Clients require explicit sync of old memorials, never automatic private project uploads. Free personal memorials have no trading or ranking value; client claims cannot prove authenticity. They never enter the new draw pool, characters/collectionCount, balances, tickets, echoes, either pity counter, checkins or leaderboards. Different accounts may keep the same memorial. The endpoint is not arbitrary asset import.
