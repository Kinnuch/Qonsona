# Qonsona

学语言的桌面软件。支持日语（JLPT N5–N1）、英语、法语、韩语、西班牙语、阿拉伯语、俄语与苏格兰盖尔语，
以及在[千语集（Qonlang）](https://github.com/Kinnuch/Qonlang)里造的语言。提供词典、阅读、课程、生词本与间隔复习、练习与训练卷、视听和统计。
题目、例句、分级都由词典和项目数据生成；自然语音使用可下载的本地神经模型。原名 Qonlang Study。

_A desktop language-learning app for Japanese, English, French, Korean, Spanish, Arabic, Russian,
Scottish Gaelic and the conlangs you build in [Qonlang](https://github.com/Kinnuch/Qonlang).
Chinese and English interface. Formerly Qonlang Study._

**0.3.0**另提供默认昆雅语（Quenya，qya）与辛达语（Sindarin，sjn）学习包，
包含 Eldamo 开放词库、来源与时期说明、原创 Neo 教学和内部 L1–L3 自测，以及离线自然语音、
收集与阅读完成练习。覆盖及限制见[昆雅语](docs/lang/qya.md)、[辛达语](docs/lang/sjn.md)。

_Version 0.3.0 adds default Quenya and Sindarin packs with an Eldamo lexicon,
period-aware sources, original Neo teaching and internal L1–L3 reviews, alongside offline neural speech,
collection and reading-completion features._

0.2.0 接入七门新增语言的开放词典与词形还原、分级阅读与新闻、发音/语法/变形/会话/惯用语/阅读课程、
语言特色练习、分级训练卷和字幕查词。实际教材覆盖与验收见 [多语言记录](docs/multilingual-progress.md)。
七门语言的训练卷是本软件自编的学习检查，未包含官方考试的全部技能与题型，不用于判定官方分数或证书等级。

## 词典每日推荐与词形

打开词典并保持查询框为空，可看到词汇、句子、语法三类每日推荐，选择日期回看，点击进入词条或讲解，
也可加入生词本、朗读/查询句子或进入对应课程。输入查询后推荐收起。推荐使用真实资料，缺少某类资料时会说明。
词条中的屈折/词形按钮展开已有词形、形态标签与来源；规则生成结果单独标明，缺项不会补猜。
盖尔语还提供有条件说明的词首音变。具体范围见 [词典使用说明](docs/dictionary.md)。

_Leave the dictionary query empty to see daily words, sentences and grammar; choose a date to revisit them.
Open entries or explanations, add words to a notebook, explore sentences or enter related lessons.
The forms button shows recorded forms and their sources, with rule outputs labelled separately and missing data left explicit.
See the [dictionary guide](docs/dictionary.md) for details._

## 离线朗读、阅读完成与收集

在「设置 → 朗读」点击「下载自然语音包」，下载经过校验的 Supertonic 3 模型，之后原文在本机合成，
无需网络、API 密钥或显卡，文字和录音不上传。模型支持英语、法语、西班牙语、日语、阿拉伯语、韩语、俄语等
31 门语言，可选择四个男女声音与语速。未下载时可使用对应语言的系统声音；eSpeak 机械文本声音须明确选择。
模型文件不放进学习数据备份，另一台电脑需重新下载。来源、许可证及安装方式见[语音说明](docs/speech.md)。

此模型按原文朗读，不是通用 IPA 引擎，也不支持盖尔语、昆雅语或辛达语。纯音标保留独立的 eSpeak-NG
音素近似，不再把 IPA 硬套英语拼写，不支持的符号会明确提示。自己的录音和学习包作者录音始终优先。
神经语音仍是合成音，音素合成仍有机械感，都不能代替真人示范或语言专家校对。Windows 在本机验收；
macOS 安装包核对原生运行库和架构，未做本机听音验收。

文章底部的“阅读完成 → 词汇与阅读练习”保留已读标记，并从本文真实词汇、原文信息定位/顺序以及可对齐译文出题；
缺少对齐译文时不猜句意，材料不足时少出或不出题。答案、完成状态及历史随文章指纹保存和转移。
新闻节选只代表读完软件保存的标题与导语，不表示读过来源全文。

0.4.0 的收藏系统使用 Qonsona / Qonlang 共享账号，服务器同步灵墨、语言伙伴、道具和寻访保底。
学习时间与每日任意/指定板块任务获得灵墨；商店兑换初识/相知语言伙伴、寻访笺与续页笺，高档语言伙伴通过寻访获得。
传颂基础概率 0.6%，20 次珍遇保底、90 次传颂保底，学习/支持券共用保底。旧版已解锁伙伴保留为纪念。
新账号默认参与排行，可选择全球/好友或退出，榜单包含当前养成伙伴。当前只有模拟支持订单，真实收款关闭。
收藏另有每七天轮换的寻访画廊：每期一只聚光传颂，轮完再重新随机，保底跨期延续；
伙伴商店使用独立档位挑选页，家园提供可摆放并云端保存多只已收藏伙伴的像素室内占位。
家具与皮肤售卖暂留空，1000 余韵可兑换一张学习寻访笺；伙伴保持原始像素大小，答对题目的鼓励会轮换。
语言伙伴分为灵动猫、逐风狗、鸣诗鸟、听雨蛙、星辉龙五个系列，图鉴先选系列再展开每只伙伴。
个体编号、已有收藏与养成记录保持不变；作者介绍保留空白框架。系列与介绍配置见[收藏说明](docs/collection.md#画廊伙伴系列与作者介绍)。
公网账号入口仍等待 ICP 备案及 HTTPS，不表示安装后已能公网登录。独立测试通过加密 SSH 通道连接服务器验证，本地学习可以正常使用。规则与入口见[收集说明](docs/collection.md)。

_Download the verified Supertonic 3 pack in Settings → Speech for local neural text synthesis without an API key or GPU.
It supports 31 languages, including seven built-in natural languages, but not Gaelic, Quenya, Sindarin or general IPA.
Personal/author recordings remain first choice; IPA uses the separate phonetic approximation with explicit unsupported-symbol errors.
See the [speech guide](docs/speech.md) for model licences and limits. Reading tasks use actual source evidence and aligned translations,
with explicit limits for excerpts and insufficient material. Version 0.4.0 collection uses shared Qonlang/Qonsona accounts,
server-owned rewards, designated daily tasks, a shop and shared-pity draws (0.6% base SSR, hard pity 90).
Leaderboard participation is optional. Support orders are simulated; real payments remain disabled.
Weekly discovery galleries feature one Legend per seven-day period, with no repeats until the full cycle ends and shared pity retained.
Tier shops have separate selection pages. The placeholder pixel home saves owned companion placements to the account.
Furniture and paid room skins are not yet offered; 1000 echoes exchange for one learning ticket. Artwork stays at source size and encouragement varies.
Language Companions are grouped into Playful Cats, Roaming Dogs, Songbirds, Rain Frogs and Starlight Dragons.
Existing companion IDs, collections and upbringing records are retained; biography fields remain blank for the author.
Public HTTPS is awaiting ICP filing; isolated testing uses an encrypted SSH tunnel to the actual server._

名字：Qon- 跟千语集 Qonlang 同一个前缀；拉丁语 _consona_ 是「同声、和谐」，跟巴别塔的语言变乱反着来；
道本语的 _sona_ 是「知道」（_kama sona_，学）。

## 下载与安装

到 [Releases](https://github.com/Kinnuch/Qonsona/releases/latest) 下载最新版本：

- **Windows**：`Qonsona-<版本>-setup.exe`，双击安装。之后有新版本时软件右下角会提示，点击「下载并安装」即可
  （只下载变了的部分，装好自动重新打开）。
- **macOS**：Apple 芯片下载 `Qonsona-<版本>-mac-arm64.dmg`，Intel 芯片下载 `Qonsona-<版本>-mac-x64.dmg`，
  打开后把 Qonsona 拖进「应用程序」。安装包没有签名，第一次打开时：
  - macOS 14 及更早：请右键点击 Qonsona，选「打开」，在弹窗里再点击「打开」即可。
  - macOS 15 起：请先双击打开一次（提示无法打开时点「完成」），然后打开「系统设置 → 隐私与安全性」，
    在下方找到 Qonsona 被阻止的提示，点击「仍要打开」并输入密码即可。
  - 提示「已损坏，无法打开」时，请在终端执行 `xattr -cr /Applications/Qonsona.app`，之后照常双击打开。

- **Linux x64**：可下载 `Qonsona-<版本>-linux-x64.AppImage`，赋予执行权限后运行；Debian / Ubuntu 可使用同版本 `.deb` 安装包。自然语音使用随包提供的 CPU 运行库，不要求 CUDA。

_Linux x64 installers are available as AppImage and Debian packages. Make the AppImage executable before running it. Local neural speech uses the bundled CPU runtime; CUDA is not required._

朗读用的系统语音暂时只有 Windows 版有；macOS 上自己的录音、作者录音照常能放。

数据目录：Windows 在 `%APPDATA%\qonsona`，macOS 在 `~/Library/Application Support/qonsona`
（「设置 → 数据」里可以打开、导出备份、从备份恢复）。装过 Qonlang Study 的，第一次打开 Qonsona 会把
`%APPDATA%\qonlang-study` 里的学习数据拷过来，原来的目录不动，确认没问题后可以自己删掉；
旧的 Qonlang Study 可以在「设置 → 应用」里卸载。

## 跨电脑转移与复习计划

生词本页可导出当前语言或选中的词本；设置页可导出所有个人学习数据。把 JSON 文件复制到另一台电脑，
导入后先检查预览，再确认合并并重启。课程进度、试卷历史、学习时长、自定义阅读与译文随个人数据一起转移。
录音和学习包使用设置中的完整 ZIP 备份；外部音视频文件需另外复制。合并规则、恢复备份与范围见 [转移说明](docs/transfer.md)。

在生词本点击「复习计划与题型」，可按语言或单个词本调整每日新词数、复习上限、间隔阶梯、掌握阈值和顺序。
各题型填 0 关闭，其他数值表示相对频次，例如词义 3、拼写 1，约每四题有三题词义和一题拼写。
支持闪卡、看词选义、看义选词、拼写、读音、听词和例句填空；题目只使用当前复习词的真实数据。
可从指定日期重排已学习卡的到期时间，保留复习历史；只修改计划不会自动移动原有到期日期。

## 千语集的语言

在千语集里点击「设置 → 数据 → 导出学习包」，设置好课程、不给学习者看的内容、个别词的级别、作者录音，
导出 `.qstudy.json`；在 Qonsona 的「语言」页导入（也可以直接导入 `.laim.json` 项目文件）。项目里每门语言
各成一门可以学的语言。读项目用的是千语集自己的引擎快照，两边看到的词形、读音、文字写法一样。
对齐方案见 [docs/qonlang-alignment.md](docs/qonlang-alignment.md)。

## 数据来源与许可

Qonsona 主程序按 [MIT](LICENSE) 许可；独立语音进程与第三方引擎的 GPL-3.0 范围另列于下，整个包并非全部 MIT。
日语数据来自下面这些开放资源（软件里「设置 → 数据来源与许可」也列着）：

| 数据                                                                                                                                             | 许可                                       | 作者                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ | ---------------------------------------------------- |
| [JMdict](https://www.edrdg.org/jmdict/j_jmdict.html)（经 jmdict-simplified）、[KANJIDIC2](https://www.edrdg.org/wiki/index.php/KANJIDIC_Project) | CC BY-SA 4.0                               | Electronic Dictionary Research and Development Group |
| [KanjiVG](https://kanjivg.tagaini.net/)（笔顺、手写查字）                                                                                        | CC BY-SA 3.0                               | Ulrich Apel                                          |
| [JLPT 词汇分级](https://www.tanos.co.uk/jlpt/)                                                                                                   | CC BY（原表）/ CC BY-SA 4.0（对到 JMdict） | Jonathan Waller；stephenmk                           |
| [kanji-data](https://github.com/davidluzgouveia/kanji-data)（汉字的新 JLPT 等级）                                                                | MIT                                        | David Gouveia                                        |
| [Tatoeba](https://tatoeba.org/) 例句                                                                                                             | CC BY 2.0 FR                               | Tatoeba contributors                                 |
| [Tomoshi 开放数据](https://github.com/tomoshi-app/tomoshi-dict-data)（中文释义、例句翻译、中日同形词、自他动词）                                 | CC BY-SA 4.0                               | Y1Z                                                  |
| 日语、中文[维基词典](https://kaikki.org/)的释义（kaikki.org / wiktextract 抽取）                                                                 | CC BY-SA 4.0 / 3.0                         | Wiktionary 贡献者；Tatu Ylonen                       |
| [kuromoji.js](https://github.com/takuyaa/kuromoji.js) 与 IPADIC（分词、读音）                                                                    | Apache 2.0；IPADIC 许可                    | Takuya Asano；NAIST                                  |
| [青空文库](https://www.aozora.gr.jp/)的公有领域作品（内置文章、民间故事）                                                                        | 公有领域                                   | 青空文库及各篇的输入、校对者                         |

常用词与 JLPT 词的中文释义由 JMdict 的英文释义翻译而来（未经人工逐条校对，随 JMdict 按 CC BY-SA 4.0）。
NHK 新闻只取公开的标题与导语，附原文链接；NHK Easy 与全文要登录 NHK ONE，软件不绕过。

开发版精灵语词汇改编自 [Eldamo](https://eldamo.org/) 的开放 XML（Paul Strack，CC BY 4.0），
保留原词条链接、文献编号和早期/中期/晚期/Neo 标记。[Elfdict](https://www.elfdict.com/about)提供交叉检索外链，
没有整站打包。原创学习说明与短句按 MIT；没有复制 Tolkien 或其他教材的长篇文本、网页字体或录音。
离线语音的独立引擎是 [eSpeak-NG / Echogarden Emscripten 编译](https://github.com/echogarden-project/espeak-ng-emscripten)，
`resources/speech/espeak/` 引擎按 GPL-3.0，`resources/speech/runner.mjs` 也按 GPL-3.0；
引擎原始 `COPYING` 与 `README.md` 原样保留，独立语音进程与引擎的许可证随安装包提供。

## 开发

- 大纲与已定的事：[docs/outline.md](docs/outline.md)
- 与千语集怎么对齐：[docs/qonlang-alignment.md](docs/qonlang-alignment.md)
- 第一个公开版本之前的开发记录：[docs/milestones.md](docs/milestones.md)

程序本体不写死任何一门语言，模块显示与否只看「学习包」的能力。Electron + Svelte 5 + TypeScript（electron-vite）。

`data/release-data.json` 使用 0.4.0 的版本化数据包 `qonsona-data-0.4.0.zip`，包含十一库及逐文件大小与 SHA-256 校验。
开发时可下载清单指定的完整数据包；需要重建精灵语词库时，再执行 Eldamo 管线。

```sh
node scripts/release/fetch-data.mjs  # 需要 GITHUB_TOKEN；按当前清单验证并下载十一库
node scripts/data/run-ts.mjs scripts/data/eldarin/build.ts --download  # Eldamo XML → qya/sjn 两库
node scripts/data/run-ts.mjs scripts/lang/validate.ts qya
node scripts/data/run-ts.mjs scripts/lang/validate.ts sjn
```

历史 0.2.0 的完整九库集合保留下载兼容。之后的数据包使用新的版本号，不重写或替换已经发布的清单与资产。

```sh
npm install --registry=https://registry.npmmirror.com   # Electron 二进制另设 ELECTRON_MIRROR
npm run data:ja      # 下载日语原始数据、生成词典数据库 resources/data/ja/dict.sqlite（约 95 MB，不入库）
node scripts/data/articles-ja.mjs   # 重新下载内置的青空文库文章（结果 data/ja/articles.json 入库，平时不用跑）
node scripts/data/folktales-ja.mjs  # 重新下载故事课的民间故事（data/ja/folktales.json 入库，平时不用跑）
npm run data:levels    # 内置文章与民间故事的难度先算好写进 articles.json、folktales.json（重新下载之后要跑一次）
node scripts/data/themes-ja.mjs     # 主题词本：词表写在脚本里，对到词典的词条号，写出 data/ja/themes.json（入库）
node scripts/data/wiktionary-ja.mjs # 维基词典的日语释义（日日词典）与中文释义：下载 kaikki.org 的抽取数据，
                                    # 生成 resources/data/ja/wikt.sqlite（不入库；没有它词典里不显示这两栏）
npm run data:examples  # 例句：语法课按语法点挑、练习与模拟卷按 JLPT 等级挑，都从词典的 Tatoeba 例句里挑
                       # （结果 data/ja/grammar-examples.json、data/ja/level-sentences.json 入库；第一次要分词、查词
                       # 两万多句，二三十秒，之后用 .cache 里的结果；改了语法点、例句、挑例句的规则都要重跑）
npm run grammar:probe -- --say "雨が降るにちがいない。"   # 写语法点用：看一句话怎么切、认出了哪些语法点；
                       # 也能看某个语法点在 Tatoeba 例句里认出了哪些、规则放过了哪些（用法见脚本开头）
npm run dev          # 或者双击 dev.cmd（不经过 PowerShell）
npm run typecheck
npm run lint
npx vitest run
npm run smoke:languages  # 先构建，再走七门语言的阅读、课程、下一课、故事跳转、训练卷与统计
npm run smoke:layout     # 五种窗口尺寸、实际滚轮、课程C2末尾、变形表与词典表格
npm run smoke:responsiveness # 120新闻和长文分析期间的点击/查词，以及首页连续稳定性
npm run smoke:review     # 真实词卡各题型、频次设置、撤回、排期和立即原生关窗保存
npm run smoke:transfer   # JSON导出、预览、合并重启、重复导入幂等
npm run smoke:save       # 录音和正文保存中立即原生关窗、正常重启后保留
npx electron-vite build && npm run smoke   # 起真的 Electron 把界面走一遍（视听会先录一段测试视频），截图在 dist/smoke/
                                          # 调试端口默认 9361，被别的程序占着时 SMOKE_PORT=9381 npm run smoke
```

Claude Code 的终端里带着 `ELECTRON_RUN_AS_NODE`，直接起 Electron 会报错，要先清掉这个环境变量。

开发版用的数据目录跟安装版一样（`%APPDATA%\qonsona`）；验收时用 `--user-data-dir` 另起一份。

### 千语集引擎快照

`src/renderer/src/vendor/qonlang/` 是千语集 `core`、`engine`、`script`、`ipa` 的快照，
别手改。跟进千语集：`npm run sync:qonlang`，然后跑上面的检查。

### 打包（Windows）

```sh
npm run pack:win                # dist/win-unpacked/Qonsona.exe
npm run installer:win           # dist/Qonsona-<版本>-setup.exe
SMOKE_EXE=dist/win-unpacked/Qonsona.exe npm run smoke   # 对着打包好的程序再测一遍
```

macOS 的 dmg 只能在 macOS 上打（`npm run build:mac`），平时交给 GitHub Actions。

## 发布与软件内更新

推送 `v<版本号>` 标签后，[.github/workflows/release.yml](.github/workflows/release.yml) 在 Windows、macOS 与 Linux 上
构建，产物挂到同名 Release：`Qonsona-<版本>-setup.exe`、同名的 `.blockmap`、`latest.yml`、
`Qonsona-<版本>-mac-x64.dmg`、`Qonsona-<版本>-mac-arm64.dmg`，以及 Linux x64 的 `.AppImage`、`.deb` 与更新清单。Release 的说明由 `node scripts/release-notes.mjs <版本>`
从 `CHANGELOG.md` 与 `CHANGELOG.en.md` 里摘中英两段。

- 词典数据库（`resources/data/<语言>/`）不入库：CI 从草稿 Release「build-data」取
  `data/release-data.json` 指定的 `qonsona-data-<版本>.zip`，核对整包及逐文件大小、SHA-256 后解压。
  新数据用新的版本号准备/上传（`scripts/release/prepare-data.mjs`、`scripts/release/upload-data.mjs`）；
  不替换旧版清单或旧版 ZIP。需要重建精灵语库时，使用上面的 Eldamo 管线。
- 软件内更新问的是 GitHub 上 `Kinnuch/Qonsona` 的 Release（仓库名写在 `src/main/update.ts`、
  `electron-builder.yml` 的 publish、`scripts/pack-win.sh` 写的 app-update.yml 三处，改名时一起改）。
- 装过的 Windows 版先试增量：拿上次安装时存下的安装包（`%LOCALAPPDATA%\qonsona-updater\installer.exe`）
  跟新旧两版的 .blockmap 比对，只下载变了的块；拼好的安装包按 latest.yml 的 sha512 校验，对不上或者走不了就整包下载。
  旧版本 Release 上的 .blockmap 别删。
- 改了更新相关的代码，按 [scripts/update-e2e/README.md](scripts/update-e2e/README.md) 做一遍端到端验收。
