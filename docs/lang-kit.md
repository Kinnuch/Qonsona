# 多语言框架约定（lang-kit）

2026-10-09 起在日语之外加七门语言：英语 en、法语 fr、韩语 ko、西班牙语 es、阿拉伯语 ar、俄语 ru、
苏格兰盖尔语 gd。用户的要求（原话）：「完全按照你逐步搭建日语框架的方法……这些语言各自有各自的特点，
所以需要你提取出它们的特点，不能盲目的照抄日语的框架。然后它们的开源资料和新闻我也希望全面，分级制度也是，
尽可能详尽」。

做法：照日语的里程碑一步步来（M1 词典 → M2 阅读与新闻 → M3 生词本 → M4 课程 → M5 练习与模拟卷 →
M6 视听 → M7 统计 → M8 补齐），每门语言一个分支、各做各的；程序本体（框架、界面）由主线统一做，
各语言只往框架里填自己的规则、数据和内容。日语那套（src/shared/ja、src/main/dict.ts……）不动，
它是参照，不是模板：先想清楚这门语言跟日语哪里不一样、学的人难在哪里，再决定做什么、怎么做。

## 分工与目录

每门语言的分支**只改自己的目录**（下面的 `<代码>` 换成 en、fr……）：

| 目录 | 放什么 |
|---|---|
| `src/shared/lang/<代码>/` | 这门语言的一切纯 TS：`spec.ts`（叫什么、分级、能力）、`rules.ts`（查词键、切词、猜原形、转写）、以后的语法点、课程、题型…… |
| `scripts/data/<代码>/` | 数据管线：下载、解析、写库（TS，用 `node scripts/data/run-ts.mjs` 跑） |
| `data/<代码>/` | 入库的小数据：公有领域课文、手挑的词表、自写例句、语法点例句……（单个文件尽量 < 2 MB） |
| `tests/lang/<代码>/` | 这门语言的测试 |
| `docs/lang/<代码>.md` | 这门语言的特点分析、资料清单（含许可）、分级、各阶段的计划与进度 |
| `src/renderer/src/lib/lang/<代码>/` | （以后的阶段）这门语言特有的界面小部件 |
| `resources/data/<代码>/` | 生成的词典数据库等（**不入库**） |
| `.cache/data/<代码>/` | 下载的原始文件（**不入库**） |

**框架归主线**：`src/shared/lang/*.ts`（types、text、levels、registry）、`src/main/lang/`、
`scripts/lang/`、界面的通用组件、`lib/i18n/*.ts`、`package.json`、这份文档。分支里**不要改**这些；
需要框架加东西（新字段、新题型、新的界面能力、新依赖），写进阶段汇报的「要框架做的」，由主线加好再合回去。
实在等不及，先在自己目录里写个本地版本，汇报里说明。

## 阶段与交付

每个阶段结束交一份汇报（格式见文末），主线合并、检查、汇报给用户之后接着下一阶段。

1. **阶段一：资料、特点与词典数据**（M1）
   - `docs/lang/<代码>.md`：这门语言的特点（文字、发音与拼写、形态、句法、学习者——尤其是中文母语者——的难点，
     跟日语的做法哪里该不一样）；**资料清单**（词典、词表、语料、例句、录音、公有领域文本、新闻，
     每条写许可、地址、取了什么、能不能再分发）；**分级**（见下文）；后面每个阶段打算怎么做。
   - `src/shared/lang/<代码>/spec.ts`、`rules.ts` 写实；`tests/lang/<代码>/` 测规则。
   - `scripts/data/<代码>/` 数据管线 → `resources/data/<代码>/dict.sqlite`，**过校验**：
     `node scripts/data/run-ts.mjs scripts/lang/validate.ts <代码>`。
2. **阶段二：阅读与新闻**（M2）——切词、认语法点、课文与新闻来源、正文的注音与记号。主线先把通用阅读器做好。
3. **阶段三：生词本**（M3）——按分级的词表、主题词本、考试词表。
4. **阶段四：课程**（M4）——字母 / 拼读、语法、变形、会话、惯用语、故事，按这门语言需要的取舍。
5. **阶段五：练习与模拟卷**（M5）——题型按语言特点（性、格、助词、变位……），模拟卷照这门语言的考试。
6. **阶段六、七：视听与统计**（M6、M7）——主要是框架的事，各语言补字幕查词等。
7. **阶段八：补齐**（M8）。

## 词典数据库（dict.sqlite）

结构在 `src/main/lang/lexdb-schema.ts`，**只能用 `scripts/lang/lexdb-writer.ts` 的 `LexDbWriter` 写**
（它保证查词键、反查、词表、meta 跟主进程读的方式一致）：

```ts
import { LexDbWriter, download, cacheDir } from '../../lang/lexdb-writer'
const db = new LexDbWriter('fr')
db.source({ id: 'wiktionary', name: 'Wiktionary（kaikki.org / wiktextract）', license: 'CC BY-SA 4.0',
            credit: 'Wiktionary contributors; Tatu Ylonen', home: 'https://kaikki.org/' })
const id = db.entry({ w: 'chat', p: ['noun'], g: 'm', ipa: ['/ʃa/'],
  s: [{ en: ['cat'], zh: ['猫'], zs: 'cfdict', ex: [] }], f: [['chats', 'plural']],
  lv: { cefr: 'A1' }, fr: 1234, src: ['wiktionary'] })
db.example({ text: 'Le chat dort.', en: 'The cat is sleeping.', zh: '猫在睡觉。', zs: 'tatoeba', src: 'tatoeba' }, [id])
db.list('theme:animals', id, 1)
db.finish()
```

- **词条 JSON**（`LexEntryData`，见 `src/shared/lang/types.ts`）：词头 `w`、显示写法 `d`（俄语重音、阿拉伯语元音符号）、
  词性 `p`（UPOS 小写：noun verb adj adv pron det adp cconj sconj num part intj aux propn，词典另有
  phrase idiom proverb affix abbr symbol other）、性 `g`、`ipa`、转写 `rom`、录音 `au`、义项 `s`、变形表 `f`、
  变形类别 `cls`、分级 `lv`、词频名次 `fr`、语言特有信息 `x`、来源 `src`。
- **变形表与标签**：`f` 是 `[形式, ...标签]`，标签一律用 Wiktextract 的标签词（plural、genitive、past、
  first-person、singular、indicative、subjunctive、feminine、definite……）。别的来源由管线对过来。
  词形表要尽量全：阅读器、查词靠它从变形找回原形。
- **义项**：`en`（英文释义）、`zh`（中文释义）+ `zs`（中文来源 id，**机器翻译的来源 id 以 `mt-` 开头**）、
  `mono`（本语言释义，给中高级）、`t`（标签：colloquial、formal、archaic……）、`dom`（领域）、`ex`（例句 id）、
  `syn` `ant` `see`。
- **x（语言特有）**：自己定键名，写进 `docs/lang/<代码>.md`；常用的：韩语 `hanja`（汉字写法）、阿拉伯语 `root`
  （词根，用空格隔开的三个字母）与 `pattern`、俄语 `aspect`（体的配对词头）与 `stressMobile`、盖尔语 `len`（弱化形）……
- **例句**：Tatoeba 等；`zs`、`src` 也要是登记过的来源 id。
- **词表**：`entry()` 按 `lv` 自动写「分级体系:等级」；主题词本用 `theme:<id>`，另外的用 `x:<id>`。
- **体积**：一门语言的 dict.sqlite 尽量 ≤ 120 MB（英语可以到 200 MB）；冷僻词、专名、过长的复合词可以不收，
  学习者用得到的要全。

查词键 `form.key` 由 `rules.key()` 算，宽松键由 `rules.looseKey()` 算——**规则改了就要重建库**，
校验会抽查键是不是这两个函数算出来的。

## 分级

用户要「分级制度尽可能详尽」：

- **主分级**（`primary: true`，恰好一套，必须是 `proficiency`）：阅读下划线、练习选级、模拟卷、文章难度都按它。
  欧洲语言一般用 CEFR A1–C2（`cefrSystem()`），韩语用 TOPIK 1–6 级，俄语可以用 ТРКИ（ТЭУ、ТБУ、ТРКИ-1…4，
  写清跟 CEFR 的对应）……按这门语言**通行的**体系来，`cefr` 写对应关系。
- **其他分级**：考试与教材词表（英语的中考、高考、四六级、考研、托福、雅思、GRE……）、官方大纲的等级、
  别的体系（ACTFL）。`kind: 'wordlist'` 的一个词可以在几张表里。
- **怎么把词分到各级**：开放的分级词表 / 官方大纲优先；没有的用词频切分（写清用了什么语料、切在哪里、为什么）。
  每套的依据写进 `sources`，`docs/lang/<代码>.md` 里写清每一级大约多少词、对不对得上官方数字。
- 各级的说明（`desc`）要写这一级能做什么、对应的考试是什么样。

## 语言规则（rules.ts）

`LangRules`（见 types.ts）：`key`（查词键）、`looseKey`（宽松键）、`tokenize`（切词，默认 `segmentWords`）、
`lemmaCandidates`（form 表查不到时猜原形：韩语去助词词尾、阿拉伯语去附着词、英语缩约……）、`marks`
（正文可开关的记号）、`romanize`（转写）。都是纯函数，`tests/lang/<代码>/` 要有测试。

## 资料与许可

- 能用：公有领域、CC0、CC BY、CC BY-SA、ODbL、GFDL、MIT/BSD/Apache、GPL/LGPL 的数据。
  CC BY-NC(-SA) 的能不用就不用；非用不可的写清楚，汇报里提出来。每份来源都 `db.source()` 登记（许可、署名、主页）。
- **新闻**：有版权的只取 RSS 里公开的标题与导语，附原文链接（日语 NHK 的做法）；全文只收开放许可的
  （维基新闻 CC BY 2.5、美国之音 Learning English 是公有领域……）。要登录、付费、反爬的一律不绕过。
- 文本：公有领域（作者去世超过 70 年、青空文库式的整理本）、开放许可的维基类内容。
- 自己写的说明、例句可以（日语的语法讲解与自写例句就是这样），但必须是地道、正确的，能用语料核对的就核对。
- **中文释义**：先找开放的中文来源（英语 ECDICT、韩语 한국어기초사전、法语 CFDICT……）；没有的语言先留英文，
  主线以后统一安排机器翻译补常用词（标 `mt-`）。阶段一里把「需要补中文的常用词」按词频列出来
  （`data/<代码>/zh-todo.txt`，一行一个词条：词头 + 词性 + 英文释义），先列前 8000 个。

## 发音

- `ipa`：维基词典等来源的 IPA；`au`：维基共享资源 / Lingua Libre 的录音地址（联网点击播放，放过的缓存）。
- 系统语音：Windows 装了这门语言的语音才能读（这台电脑只有中文、英语、日语）。盖尔语没有 Windows 语音，
  靠录音与 IPA。
- 用户自己的录音、千语集式的「先放录音，再读语音」顺序沿用。

## 环境与规矩

- 每个分支在自己的 git worktree 里做：`Documents\GitHub\Qonsona-wt\<代码>`（分支 `lang/<代码>`）。
  `node_modules`、`resources/data`、`.cache` 是连到主仓库的目录联接（junction），**别删这几个目录**（删联接用
  `cmd /c rmdir <路径>`，千万别 `rm -rf`，会把主仓库里的删掉）。
- 不加 npm 依赖（要的话写进汇报）。能用：Node 内置（node:sqlite、node:zlib、fetch……）、fflate（zip / gzip）、
  seek-bzip（bz2）、esbuild。TS 脚本用 `node scripts/data/run-ts.mjs <脚本>` 跑，要在 worktree 根目录。
- Claude Code 的终端带着 `ELECTRON_RUN_AS_NODE`：起 Electron 前先 `unset ELECTRON_RUN_AS_NODE`。
- 起程序（开发版）**必须**带 `--user-data-dir=<你自己的临时目录>`：不带的话会用用户真实的数据目录
  `%APPDATA%\qonsona`。用户装的 Qonsona（`Documents\Qonsona`）常开着，**不要碰它**，停进程按路径别按名字。
  调试端口按语言分：en 9411、fr 9412、ko 9413、es 9414、ar 9415、ru 9416、gd 9417。
- Bash 工具会把命令里两个连着的反斜杠压成一个；Write 工具会把内容里「反斜杠 u 加四位十六进制」写成真字符
  （要写这种转义就用 `String.fromCharCode` 之类）。
- 注释用中文、跟周围代码一个口吻；格式按 prettier（`npx prettier --write <文件>`）。
- 检查：`npx vitest run tests/lang/<代码>`、`npm run typecheck`（整个项目，0 错误）、`npm run lint`。
- git：只在自己的分支提交（`git add` 自己的目录），提交信息中文，末尾加
  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`；**不推送**。
- 下载大文件放进 `.cache/data/<代码>/`（`download()` 会跳过已经下好的）；从这台机器连国外站点可能很慢，
  先挑小而精的来源，下载放后台、别干等。

## 汇报格式

每个阶段结束，最后一条消息按这个写（主线拿它合并、转告用户）：

1. 做了什么（文件、数据量、词条数、各级词数、库大小）
2. 怎么验证的（测试、校验工具的输出）
3. 用了哪些资料（许可）；放弃了哪些、为什么
4. 这门语言的特点决定了哪些跟日语不一样的做法
5. 要框架做的（新字段、新题型、界面能力、依赖）
6. 没做完的、下一阶段打算
7. 分支上的提交（`git log --oneline` 的几行）
