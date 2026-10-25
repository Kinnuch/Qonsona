# 收藏、灵墨与寻访（0.4.3，含未发布支付说明）

0.4.2版允许未登录浏览收藏，免费领取一只初识档语言伙伴。在线收藏与排行榜使用 Qonsona / Qonlang 共享账号。账号、灵墨、语言伙伴、道具、寻访结果与保底保存在服务器，不同电脑分别登录同一账号即可查看。2026-10-25 起，备案与 HTTPS 已就绪，公网账号和普通收藏接口已接通。本分支的微信支持支付尚未发布，实际是否可付以服务器配置和界面状态为准；生产测试赠券与公网管理员接口关闭。Qonlang 本地工程仍可离线使用，工程正文和录音不上传。离线也可退出本机账号。

收藏分为「画廊、家园、每日任务、商店、寻访、行囊」。四档语言伙伴称为初识 A、相知 R、珍遇 SR、传颂 SSR。常规目录使用用户提供的三张素材：二十只语言伙伴，每档五只；蓝色小伙伴作为月度专属素材，独立于寻访和商店。

## 访客浏览与首只伙伴（0.4.2）

未登录时可以查看画廊、伙伴系列、图鉴、商店和其他收藏页签。在「商店 → 初识」任选一只常规初识伙伴，确认后免费领取；本机只提供一次，不扣灵墨。领取后伙伴可在左下角陪伴学习并提供鼓励，记录重启后保留。本机记录损坏或无法保存时会提示重试，不重置免费名额。

兑换第二只、其他档位、寻访或购买点券时，会说明需要登录并打开登录 / 注册界面。可以按 Esc、点击关闭或背景取消；取消或登录成功都不会自动执行先前的消费，需要重新选择并确认。未登录不会获得云端灵墨、券、经验或排行榜时长；家园只提供本机伙伴预览。

成功登录且版本核验通过后，客户端将本机首只伙伴同步到该账号一次。账号已经领取过首只时保留原账号的选择；账号已经拥有同一只时不重复增加数量，不发重复余韵。网络重试使用原请求编号；同步未完成时提示重连并暂停在线消费。本机领取记录与账号关联后，不再自动送给另一个账号。退出登录仍可查看本机首只伙伴。

_Version 0.4.2 lets visitors browse the gallery, companion series, catalog, shop and collection tabs. Choose one regular Acquaintance companion in Shop → Acquaintance and confirm to claim it free, once per local profile. The companion and claim persist across restarts. A corrupt or unwritable record reports an error instead of reopening the free allowance._

_Further redemptions, draws and support-ticket purchases explain the login requirement and open login / registration. Escape, the close button and the backdrop dismiss it. Neither cancellation nor successful login executes a purchase automatically. Visitor companions can provide encouragement and a home preview; cloud currency, tickets, XP and leaderboard time require an account._

_After verified login, the local starter syncs once to that account. An existing account starter is retained; an already owned matching companion is not duplicated and earns no echoes. Retries use the original request ID. Pending synchronization pauses online spending until reconnection. Once bound, the local claim is not automatically granted to another account; signing out retains the local starter view._

_As of 2026-10-25, ICP filing and HTTPS are ready, and the latest client can use public registration, login and ordinary collection routes. This branch's WeChat support payments are unreleased; actual availability follows server configuration and UI state. Production grants and public administrator routes are disabled. Desktop UI checks use isolated profiles and services._

## 账号版本要求（0.4.1）

Qonsona 在线账号的版本要求由客户端与服务器共同核验 GitHub 最新正式版，只有实际客户端版本完全一致时才允许注册、登录、云端收藏及其他在线操作。未核验时继续使用本地学习；版本不符时显示检查更新和下载入口。0.4.1 已发送所需版本头，后续仍跟随最新正式版要求，不永久固定为 0.4.1。

「无法连接账号服务」表示未能建立服务连接；「暂时无法核验最新版本」表示最新版策略不可用，两者分别说明。公开版本预检不发送密码或登录令牌，预检异常不会误删已保存的会话。未知交易保留原请求编号，版本重新核验通过后再恢复，期间不自动重发消费；已有收藏、钱包、经验及家园不因版本检查被清空。旧 Qonlang 的注册、登录、个人资料和退出等基本账号操作保持兼容，不能借其会话绕过 Qonsona 收藏要求。

**部署顺序：先完成新客户端发布，再启用对应服务器策略。** 0.4.0 未发送新版本头，需更新到支持该协议的客户端。当前服务器动态核验 GitHub 最新正式版，kinnuch.cn 的公网 HTTPS 账号入口已于 2026-10-25 接通；本地学习和文件转移不受版本核验影响。服务规则见[账号协议](../server/contract.md)，部署说明见[服务说明](../server/README.md)。

## 灵墨与每日任务

0.4.3 将「支持开发」与学习寻访笺、续页笺并列放在「学习补给」商品栏；灵墨不足的这两项商品还会额外显示「购买支持开发」。点击后，在补给栏下方、余韵兑换之前展开支持说明及订单区，不自动下单；未登录时先弹出登录界面。支持开发对应支持寻访笺，不增加灵墨，也不能代替续页笺。模拟模式明确显示测试订单及请勿付款提示，禁用模式不能下单；真实扫码需要新的支付协议与完整服务器配置。

_Version 0.4.3 places Support development alongside learning discovery tickets and makeup slips in Study supplies. These two Ink-priced products also show a support purchase entry when the balance is insufficient. Opening it displays details and orders below supplies, before Echo exchange, without creating an order; visitors are asked to sign in. Support provides support discovery tickets, not Ink or makeup slips. Simulation explicitly prohibits real payment; disabled mode cannot create orders. Live scanning requires the new protocol and complete server configuration._

有效学习要求窗口可见且在前台，处于阅读、练习、课程、生词本、词典或视听模块，最近两分钟有操作。只播放媒体、首页及收藏浏览不计。客户端每十五秒结算；服务器按账号合并设备的最近在线时间，重叠时间不累加，首次心跳只初始化。

- 每个有效学习分钟获得 2 灵墨，每日最多 120（首 60 分钟）。服务器接受的排行榜时长每日最多 120 分钟；离线、本轮登录前及历史本地时长不追溯领取积分。
- 每日三项目标各 20 灵墨：完成任意学习活动、完成指定板块一、完成指定板块二。默认阅读和复习；当天开始计时或完成活动前可调整一次，两个板块须不同。第一次阅读可完成「任意」与「阅读」，再读文章不能代替复习。
- 星期一至星期日内至少五个不同日期，每日有 10 分钟云端有效学习并完成一个活动，获得一次 80 灵墨周奖励，满足第五日条件即发。补签不参与周奖励。

阅读完成、结束已作答练习、明确完成课程或结束有作答复习产生完成事件。同一天同语言、活动类别与内容只计一次。打开页面、旧「学过」记录和故事课导航不计完成。客户端上报不能证明真人实际学习；服务器限制重放、异常数值与重叠时间。

商店价格：初识语言伙伴 240 灵墨、相知 720、寻访笺 240、续页笺 80。珍遇和传颂只从寻访获得。点击伙伴档位进入独立挑选页面；该页只显示该档伙伴，可返回商店，寻访笺和续页笺留在补给区。已拥有语言伙伴不能重复直购。余韵每 1000 个可兑换一张学习寻访笺；家具用途留待后续，当前不售卖家具或微光装裱，原装裱库存保留。

## 寻访概率与保底

| 档位     | 基础概率 | 重复获得余韵 |
| -------- | -------: | -----------: |
| 初识 A   |      70% |            1 |
| 相知 R   |    24.4% |            3 |
| 珍遇 SR  |       5% |            8 |
| 传颂 SSR |     0.6% |           20 |

连续 19 次未获得珍遇或传颂，第 20 次至少珍遇。连续未获得传颂时，第 76 次传颂概率为 5.6%，之后每次提高 5 个百分点，第 89 次为 70.6%，第 90 次必得传颂。传颂判定优先；非传颂按 70:24.4:5 归一化分配，有珍遇保底时只落入珍遇。

寻访画廊长廊列出本期全部可抽伙伴，中央聚光灯展示本期传颂；初识、相知、珍遇仍从该档常规目录均匀选择。本期只有一只可抽传颂，以服务器显示的起止时间为准，每七天换期。传颂全部轮完之前不重复，轮完才重新随机；换轮交界也避免相邻重复。服务端保存轮次与奖池，所有账号与设备一致，重启不重抽；月度伙伴不在普通池。

确认寻访绑定所见奖池编号。换期后尚未提交的确认会要求刷新重确认；已提交操作仍按原请求恢复原期结果，换期不重置保底。

学习笺与支持笺余额分开，**共用一套保底**。单次/十次只扣所选来源，余额不足不自动混用。传颂重置两项保底，珍遇只重置珍遇保底。重复语言伙伴保留数量并发余韵，不作为新的独立收藏计入榜单。

服务器在同一 SQLite 事务中扣券并保存结果和保底。网络中断保留原请求编号，重连或重启恢复同一次结果；多设备重放不会重复扣券，界面忽略迟到的旧修订。消费前有确认，失败可重试原交易。

## 续页笺与旧纪念

续页笺库存最多 3 张，可补最近 7 天中未打卡日期，每个当前自然月最多用 2 张。它只补日历，不增加时长、任务、积分或周奖励。

旧版已解锁伙伴保留为纪念，登录后可预览并明确点击「同步旧纪念」，在其他设备查看。它没有灵墨、券、保底或榜单价值；新活动停止旧版 5/15/30 分钟免费解锁。JSON/ZIP 转移仍保留本地学习数据和旧纪念，**不能覆盖云端钱包或导入付费券**。

## 排行榜

支持收藏数量、总时长及各语言时长。收藏数只计不同的新语言伙伴；时长只计登录后服务器接受的在线有效时间，与统计页本地历史可能不同。新账号默认参加收藏与时长榜，可分别关闭，也可把可见范围设为仅好友；已关闭的原账号保留其选择。公开只显示昵称、随机公开编号和榜单数值，不显示登录用户名、付款金额或私有内容。

## 支持券、微信支付与测试入口（支付接入未发布）

正式模式启用后，所有正常登录且通过版本检查的账号均可创建支持订单，不需要 Administrator 身份或人工名单。默认每张支持寻访笺 6 元，账号每个上海自然月内待付款与已确认订单合计最多 60 元。商户后台当前另有每日 10 元限额，由实际支付提示约束，不是软件硬编码的每日额度；账号月限额不会因此提高。支持券与学习券分开，不增加灵墨或续页笺。

请在「支持开发」选择数量并明确确认，客户端显示本机生成的微信二维码。扫码完成后，只有服务器验证 YunGouOS 回调签名并主动查单，核对商户、订单、金额与支付流水，才会自动确认到账并发券。截图、二维码已显示、点击「检查到账」或客户端的成功提示都不直接发券。同一订单、回调、交易流水和网络重试不能重复发券。旧版 0.4.3 的测试订单界面缺少新支付协议，不能创建真实订单，需要更新。

如果二维码创建结果未知，订单仍保留，但不会显示猜测的二维码或发券。可以在订单记录中「检查到账」；确需重新付款时，请明确关闭原订单。服务器先查单，已经付款则确认到账，尚未付款才请求供应商关闭；关闭结果未知时保留原订单，不能据本机倒计时或收起页面认定已关闭。只有上游确认关闭后，才可重新创建订单。不要连续新建订单代替查询。

软件不会自动向微信发起退款，也不会自动获知商户后台的全部退款。运营人员可通过受保护的管理员入口，凭退款单号只读查询并核验：全额退款且支持券未消费时扣回原券；部分退款或支持券已经消费时保留馆藏、转为人工处理，并暂停继续消费支持券。普通支付查单不能代替退款核验。相关部署、密钥和接口见[服务说明](../server/README.md#yungouos-wechat-payments-unreleased)与[支付协议](../server/contract.md#support-payments-administration-and-isolated-tests)。本分支的隔离验收不代表真实付款已经完成验收，支付开关默认关闭。

正式切换方案会先备份旧测试库，保留账号身份、密码哈希与个人资料，云端钱包、学习奖励、伙伴、经验、家园、打卡与保底从零开始；本机学习文件不删除。旧会话不迁移，请使用原账号密码重新登录。旧测试请求只迁移失效标记，不能重放旧余额、赠券或变成真实订单；不复制含旧资产的响应。方案的执行状态与实际收款状态分别核验。

_When live mode is configured, ordinary authenticated, current-version users can purchase support tickets without an Administrator role or manual whitelist. Defaults are CNY6/ticket and CNY60/account per Shanghai calendar month, counting pending and approved orders. The merchant dashboard's current CNY10/day limit is separate and not hardcoded into the app. Support tickets do not replenish Ink or makeup slips._

_The client renders a native WeChat QR locally after explicit order confirmation. Credit requires a signed provider callback and an authoritative check of merchant, order, amount and transaction. Screenshots, local success messages and pressing Check payment cannot grant tickets. Unknown QR creation retains the same uncredited order. Check that order, or explicitly close it before making a replacement: paid orders settle, pending orders close only after provider confirmation, and unknown closure retains the reservation. Dismissing the page or reaching a local countdown is not closure. Older0.4.3 clients need the new payment protocol._

_No automated money refund or blanket dashboard-refund detection is implemented. An operator can explicitly query a refund record using its number through the private admin route. Full unused credit is reversed; partial or consumed refunds require manual review and freeze further support spending while retaining the collection. Production cutover retains identities/password hashes and profiles, archives the test database, resets cloud assets and does not migrate sessions. Sign in again with existing credentials. Retired request IDs block stale test replays; local learning files remain intact. This unreleased branch and isolated checks do not establish that a real payment has passed acceptance._

0.4.0 正式安装包移除 `kinnuch` 赠券入口，生产服务也拒绝赠券。专用隔离测试版须同时开启构建、主进程和服务端测试开关；登录后词典搜索 `kinnuch` 并回车，每次领取 100 学习寻访笺，可不限次数重复领取，同一请求编号的网络重试不累加。测试余额不迁入正式服务。

_Production has no keyword-grant allowance. Isolated test builds require their own client/main/service gates and database; simulated balances are never promoted to production._

## 素材与阅读数据

用户提供 `00_02_1 (4).png`、`00_02_3.png`，各 126×78 RGBA，三列两行。完整复制为 `src/renderer/src/assets/collection/companions-dawn.png` 和 `companions-journey.png`，每格 42×39。所有页面按原始裁剪像素尺寸展示，框大也不放大；只有图大于容器才等比缩小。名字为软件界面命名，不冒认作者或额外许可。

个人数据转移保留 `article-quizzes/<packId>.json` 的文章指纹、答案、完成状态和历史。同指纹保留更完整答案并去重历史，不同指纹需要重做。仅词本转移不携带本文练习；学习包和录音用完整 ZIP，外部文件另行复制。

## 验证

`npm run typecheck`、`npm run lint`、`npx vitest run` 验证客户端，`npm run server:test` 验证服务事务、权限、任务、保底、补签和支付。`npm run smoke:accounts` 使用独立临时档案、真实 API 和 Electron 界面；可将 `SMOKE_API_BASE` 设为本地 SSH 转发地址验收云端。

## 画廊、伙伴系列与作者介绍

馆藏页采用金框画廊，头图三页分别展示最新批次每日推荐的一只伙伴、服务器每日半价和当前人气传颂。最新批次页显示实际上架日期；人气按拥有该伙伴的账号数计算，不按重复数或充值排序。五秒自动左右切换，支持圆点、左右箭头、键盘；鼠标悬停/焦点、后台或减少动态效果设置时暂停。

每天亚洲上海日期稳定随机一只初识/相知语言伙伴五折（120/360灵墨），各设备一致。商店先选档位，再看每只配图和价格。服务端按当天价格扣除；客户端发送确认价格，跨午夜不匹配会要求刷新重确认，重放已提交交易仍返回原结果。

图鉴先展示五个伙伴系列，再展开具体每只：灵动猫、逐风狗、鸣诗鸟、听雨蛙、星辉龙。按作者确认的编号，猫为 1、2、3、7、8、9，狗为 4、5、10、11，蛙为 6、12，龙为 13、14、15、17、18、19、20，鸟为 16 和月度澄空鸟。每只伙伴的名字补充对应动物名称，既有伙伴编号不变，收藏数量、钱包、养成经验、家园和寻访记录继续使用原编号。

作者可编辑 [伙伴目录](../server/catalog.json) 的 speciesId、名称和 biography.introduction/traits/story，以及 [系列配置](../server/species.json) 的系列名称。介绍字段全部留空，界面显示「尚未撰写」；月度模板在 `server/catalog.mjs`。隐藏款仅预留 species.hiddenCharacterId 合同，当前不发放隐藏款。

像素素材保持正向；斜放的是画框装饰。绘制用 pixelated 等比裁片与缩放，没有直接旋转像素图导致的插值模糊。后续真旋转需要在最近邻放大后旋转再还原，此轮无像素图旋转操作。

## 养成、鼓励与伙伴收藏品

在已拥有伙伴的详情点击「设为养成」，默认出现在侧栏左下的独立空间，不遮住导航文字。可拖动或用方向键移动，位置按当前账号保存在本机；展开气泡、设置或调整窗口时重新约束边界。可归位、关闭鼓励气泡、开启双语朗读。当前静态素材，动画接口已留。

课程、普通练习、考试交卷、文章题及生词本客观题的首次正确判题触发鼓励，主观闪卡自评与重复撤回不刷经验。每题5XP、每账号每天最多200题有经验，各伙伴分别累计；五个书签节点为100/300/700/1500/3000XP，各赠一次无经济价值的伙伴收藏品。切换伙伴保留进度，每只最多五件。正确题绑定判题当时的养成选择，另一设备已更换时先刷新，不将旧题发到新伙伴；未知交易须先重连恢复。

十门内置语言提供原文与中文鼓励，以每语言独立的随机轮换顺序用完再循环，换轮时也不连续重复。七门常见自然语言各六句、盖尔语三句、昆雅两句、辛达三句；精灵语使用可核验的短语或词汇，不伪造完整新造语句。盖尔语与精灵语显示来源链接。未知导入语言先轮换六句中文，待作者提供可靠原文。默认只显示文字；朗读开启后仅用匹配语言声音，没有声音时文字显示，不套英语或抢占题目音频。连续累计45分钟有效前台学习会提醒休息，真实学习间隔至少10分钟后重新计时。离线学习继续保留本地记录，云端经验不宣称可离线补发。

## 像素家园（占位）

家园目前是一间像素室内占位房，供作者后续绘制皮肤；可从已拥有馆藏选伙伴摆入、拖拽或用方向键移动、移出并明确保存。每只图鉴伙伴可摆放一次，最多三十只；坐标以房间内的比例保存，窗口大小改变不丢失位置，素材不放大。保存到同一云端账号，跨设备家园修订冲突要求刷新重确认，不覆盖另一设备的修改。

家园伙伴当前使用静态图；动画随后由作者提供。家具与皮肤售卖区保留空状态，不虚构已可购买的家具或价格。`server/home-skins.json` 为后续皮肤配置入口，当前只有免费的占位房。家园摆放和当前养成选择分别保存，可以放入多只馆藏。

## 好友与月度专属

用公开编号发邀请，收件人接受才建立双向好友；可拒绝或移除，移除后双方好友榜同时取消。全球/好友两类榜可切换，朋友榜只显示自己和已接受好友，仍尊重每人的参榜开关；全球不显示选择仅好友的账号。每行显示当前养成伙伴的图片和名称，没有选定时留空。

月度伙伴澄空鸟要求该自然月每一天都完成三项任务，以服务器上海日期为准，含闰年天数；最后一天条件齐备自动发放一次，保存该月编号。补签不补任务、不追溯早期日期，不进普通池/直购；当前各月先复用提供的蓝色素材并显示月份，月度图片可由作者后续替换。
