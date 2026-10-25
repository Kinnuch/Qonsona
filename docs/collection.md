# 收藏、灵墨与寻访（0.4.5，2026-10-25）

0.4.2版允许未登录浏览收藏，免费领取一只初识档语言伙伴。在线收藏与排行榜使用 Qonsona / Qonlang 共享账号。账号、灵墨、语言伙伴、道具、寻访结果与保底保存在服务器，不同电脑分别登录同一账号即可查看。0.4.4（2026-10-25）加入独立支持开发套餐页和微信扫码付款；实际可付状态取决于服务器配置及渠道限额。公网账号和普通收藏接口已接通，生产测试赠券与公网管理员接口关闭。Qonlang 本地工程仍可离线使用，工程正文和录音不上传。离线也可退出本机账号。

收藏分为「画廊、家园、每日任务、商店、寻访、行囊」。四档语言伙伴称为初识 A、相知 R、珍遇 SR、传颂 SSR。常规目录使用用户提供的三张素材：二十只语言伙伴，每档五只；蓝色小伙伴作为月度专属素材，独立于寻访和商店。

0.4.5 修复交易确认弹窗在明暗主题下的透明背景。确认框会清晰显示交易说明和操作按钮；按 Esc 或点击「取消」即可返回，不提交交易。

_Version 0.4.5 gives transaction confirmations an opaque surface in light and dark themes. Review the transaction and its buttons clearly; Escape or Cancel returns without submitting it._

## 访客浏览与首只伙伴（0.4.2）

未登录时可以查看画廊、伙伴系列、图鉴、商店和其他收藏页签。在「商店 → 初识」任选一只常规初识伙伴，确认后免费领取；本机只提供一次，不扣灵墨。领取后伙伴可在左下角陪伴学习并提供鼓励，记录重启后保留。本机记录损坏或无法保存时会提示重试，不重置免费名额。

兑换第二只、其他档位、寻访或购买点券时，会说明需要登录并打开登录 / 注册界面。可以按 Esc、点击关闭或背景取消；取消或登录成功都不会自动执行先前的消费，需要重新选择并确认。未登录不会获得云端灵墨、券、经验或排行榜时长；家园只提供本机伙伴预览。

成功登录且版本核验通过后，客户端将本机首只伙伴同步到该账号一次。账号已经领取过首只时保留原账号的选择；账号已经拥有同一只时不重复增加数量，不发重复余韵。网络重试使用原请求编号；同步未完成时提示重连并暂停在线消费。本机领取记录与账号关联后，不再自动送给另一个账号。退出登录仍可查看本机首只伙伴。

_Version 0.4.2 lets visitors browse the gallery, companion series, catalog, shop and collection tabs. Choose one regular Acquaintance companion in Shop → Acquaintance and confirm to claim it free, once per local profile. The companion and claim persist across restarts. A corrupt or unwritable record reports an error instead of reopening the free allowance._

_Further redemptions, draws and support-ticket purchases explain the login requirement and open login / registration. Escape, the close button and the backdrop dismiss it. Neither cancellation nor successful login executes a purchase automatically. Visitor companions can provide encouragement and a home preview; cloud currency, tickets, XP and leaderboard time require an account._

_After verified login, the local starter syncs once to that account. An existing account starter is retained; an already owned matching companion is not duplicated and earns no echoes. Retries use the original request ID. Pending synchronization pauses online spending until reconnection. Once bound, the local claim is not automatically granted to another account; signing out retains the local starter view._

_Version 0.4.4 (2026-10-25) adds a separate support-package page and WeChat checkout. Public HTTPS registration, login and collection require the latest client; payment availability follows server configuration and channel limits. Production grants and public administrator routes are disabled. Desktop UI checks use isolated profiles and services._

## 账号版本要求（0.4.1）

Qonsona 在线账号的版本要求由客户端与服务器共同核验 GitHub 最新正式版，只有实际客户端版本完全一致时才允许注册、登录、云端收藏及其他在线操作。未核验时继续使用本地学习；版本不符时显示检查更新和下载入口。0.4.1 已发送所需版本头，后续仍跟随最新正式版要求，不永久固定为 0.4.1。

「无法连接账号服务」表示未能建立服务连接；「暂时无法核验最新版本」表示最新版策略不可用，两者分别说明。公开版本预检不发送密码或登录令牌，预检异常不会误删已保存的会话。未知交易保留原请求编号，版本重新核验通过后再恢复，期间不自动重发消费；已有收藏、钱包、经验及家园不因版本检查被清空。旧 Qonlang 的注册、登录、个人资料和退出等基本账号操作保持兼容，不能借其会话绕过 Qonsona 收藏要求。

**部署顺序：先完成新客户端发布，再启用对应服务器策略。** 0.4.0 未发送新版本头，需更新到支持该协议的客户端。当前服务器动态核验 GitHub 最新正式版，kinnuch.cn 的公网 HTTPS 账号入口已于 2026-10-25 接通；本地学习和文件转移不受版本核验影响。服务规则见[账号协议](../server/contract.md)，部署说明见[服务说明](../server/README.md)。

## 灵墨与每日任务

「支持开发」与学习寻访笺、续页笺并列放在「学习补给」商品栏；灵墨不足的这两项商品还会额外显示「购买支持开发」。0.4.4 点击后进入独立套餐与订单页面，可返回商店；进入页面不自动下单，未登录时先弹出登录界面。支持开发对应支持寻访笺，不增加灵墨，也不能代替续页笺。模拟模式明确显示测试订单及请勿付款提示，禁用模式不能下单。

_Support development appears beside learning tickets and makeup slips, with another entry when their Ink balance is insufficient. In 0.4.4 it opens a separate package/order page, with a return to Shop and no automatic order. Visitors are asked to sign in. Support grants support tickets, not Ink or makeup slips; simulation prohibits real payment and disabled mode cannot create orders._

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

## 支持券、微信支付与测试入口（0.4.4）

正式模式启用后，所有正常登录且通过版本检查的账号均可购买，无需管理员身份或人工名单。选择套餐并确认金额后才创建微信订单，二维码由客户端在本机生成。支持券与学习券分开，不增加灵墨或续页笺。

| 套餐               |                          金额 |                支持寻访笺 |
| ------------------ | ----------------------------: | ------------------------: |
| 每账号首次支付优惠 |                         ¥0.01 |                        10 |
| 一份支持           |                            ¥6 |                        10 |
| 长久相伴           |                           ¥60 |            100 + 10 = 110 |
| 一路同行           |                          ¥600 |         1000 + 100 = 1100 |
| 自定义             | ¥0.60–¥600，须为 ¥0.60 整数倍 | 每 ¥0.60 一张，无额外赠送 |

首付资格在下单时锁定，同账号不能同时创建第二张首付优惠订单。创建或关闭结果未知时请查询原订单；渠道明确确认未付款并关闭后，可再次尝试首付。成功付款后永久限一次，退款也不重置；任何历史已付款记录会排除新优惠。此前 0.01 元测试订单仍按原一张券保存，不追补、不改价。应用取消旧每月 60 元上限，单笔最高 600 元；渠道商户限额仍独立生效，当前后台显示每日 10 元，以实际付款提示为准。

只有服务器验证渠道签名并主动查单，核对原订单、商户、金额和唯一支付流水后才发券；截图、二维码或客户端提示不能发券。订单结果未知时保留同一订单和查询入口，不猜测二维码或付款结果。未付订单十分钟到期后，服务器主动核对并关闭，重启后继续处理；渠道故障时保持核对中，倒计时结束、收起页面不等于已关单。已付及迟到付款均保留原价和权益核实处理，已关订单也可主动「检查到账」。不要连续新建订单代替查询。

异常重复优惠付款会保留付款记录并转人工核验，优惠券只发一次；此状态可能暂停支持券消费。软件不自动发起微信退款，也不自动获知后台所有退款。运营人员须凭渠道退款单号核验：全额退款扣回原来实际发放且未消费的券；部分退款或已消费时转人工处理，保留馆藏并暂停继续消费支持券。普通支付查单不能代替退款核验。服务端定价、账号鉴权和回调核验使用 HTTPS；私密配置权限等边界见[服务说明](../server/README.md#yungouos-wechat-payments)与[支付协议](../server/contract.md#support-payments-administration-and-isolated-tests)。

旧测试库与正式资产隔离：身份和密码哈希可以保留，测试钱包、伙伴和保底不迁入正式资产；旧请求只保留失效标记，不能重放旧余额或创建真实订单。本机学习文件不删除。此规则不表示每次更新都会重置正式资产；正式订单与余额在版本升级中保留。

_The separate support page offers first payment CNY 0.01/10 tickets, CNY 6/10, CNY 60/110, CNY 600/1100, or custom CNY 0.60–600 in exact CNY 0.60 steps without bonuses. Eligibility is reserved on ordering, available again after confirmed unpaid closure, and permanently consumed by payment even after refund. Any historical payment excludes the offer; old one-fen/one-ticket records are not upgraded. The former CNY 60 monthly application cap is removed; each order is at most CNY 600, subject to the channel's independent limit (currently CNY 10/day). Support tickets do not replenish Ink or makeup slips._

_The server verifies channel signatures and queries the original merchant/order/amount/transaction before credit. At ten minutes a persistent worker verifies and closes unpaid invoices; outages remain unresolved, and late genuine payment can still be checked. Unknown creation keeps the original order; a hidden QR or dismissed page is not confirmed closure. Abnormal duplicate promotional payments retain financial records for review without issuing another discount entitlement. Money refunds are not automatic: verified full unused refunds reverse only tickets actually credited; partial or consumed refunds require review and freeze further support spending. Test assets are excluded from production; local learning files and existing formal assets survive updates. See the [service guide](../server/README.md#yungouos-wechat-payments)._

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
