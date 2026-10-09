# 英语（en）

> 负责：lang/en 分支（worktree `Documents\GitHub\Qonsona-wt\en`）。约定见 [lang-kit.md](../lang-kit.md)。
> 状态见文末「进度」。

## 一、英语的特点，以及跟日语的做法哪里不一样

### 1. 文字与拼读

- 26 个拉丁字母，基本不用附加符号（café、naïve、résumé 这类外来词例外，查词时宽松键会去掉附加符号）。
  字母本身不难，难在**拼写跟读音的对应很不规则**：同样的 ough 有 tough / though / through / thought / bough
  五种读法；同形异音（read、lead、wind、tear、live）；不发音的字母（knight、psychology、debt、island）。
- 日语要注振假名，英语不用注「读音假名」，但离不开**音标**：词条给英式、美式两套 IPA；以后阅读器可以在
  词上方注 IPA（`features.ruby = 'ipa'`，给初学者用）；课程里讲的不是逐个字母，而是**拼读规则**
  （phonics：字母与字母组合的常见读法、开音节与闭音节、不发音的 e、重读与弱读元音）。
- 中文母语者在学校学的多半是英式音标的课本写法（DJ / Gimson 一路：/e/、/ʌ/、/r/、/əʊ/、/eə/），
  词典里常见的美式写法是 /r/、/ɚ/、/oʊ/、单音节词不标重音。所以：英式 IPA 取 Britfone 后换成课本写法
  （ɐ→ʌ、ɹ→r、ɛ→e、ɛə→eə，重音符号挪到音节开头），美式取 ipa-dict 后换成词典写法（ɹ→r、ɫ→l、
  非重读的 ɝ→ɚ、单音节去掉重音符号）。

### 2. 发音：重音、弱读、连读

- 重音位置不固定，还会随派生移动（PHOtograph / phoTOgraphy / photoGRAphic）；有的词靠重音分词性
  （REcord 名词 / reCORD 动词）。IPA 都标主重音（ˈ）与次重音（ˌ）。
- **功能词有强读与弱读**：and /ænd/ → /ənd/ /ən/ /n/，to /tuː/ → /tə/，can /kæn/ → /kən/，
  of /ɒv/ → /əv/。句子里功能词几乎都读弱读式，这是中国学生听不懂原速英语的主要原因之一。
  词条另记弱读式（`x.weak`，从 Britfone、ipa-dict 的多种读音里按「没有主重音、元音弱化」自动挑出来，
  不手写）；听力课（阶段四、六）再讲连读、失去爆破、同化、t 的闪音。
- 英美口音差别：bath /bɑːθ/ ~ /bæθ/、r 音（car）、hot /hɒt/ ~ /hɑt/、go /əʊ/ ~ /oʊ/、water 的 t。

### 3. 拼写的英美差异

colour / color、centre / center、organise / organize、travelling / traveling、programme / program、
defence / defense、grey / gray、aeroplane / airplane……两种写法都收成词条，互相指认（`x.var`）；
来源是 CEFR-J 词表里「color/colour」这种并列写法（按词性给的级两边一样）。

### 4. 形态：变化少，不规则多

- 名词复数（-s / -es / -ies / -ves，children、mice、analyses、data）；动词第三人称单数、过去式、
  过去分词、现在分词（常用的不规则动词两百来个）；形容词、副词的比较级与最高级（good / better / best）。
- 跟日语不同：日语的变形一层套一层，靠还原规则（`src/shared/ja/deinflect.ts`）一步步剥；英语变化少而
  不规则多，**查原形主要靠变形表**（ECDICT 的 exchange 字段与 lemma 表，几万个词形进 form 表），
  规则（`lemmaCandidates`）只在表里查不到时兜底：-s、-es、-ies、-ed、-ing、-er、-est、双写辅音、
  去 e、y→i，以及缩约与所有格。
- 缩约：don't、I'm、it's、we've、won't、can't、let's；所有格 's、s'。正文切词时**一个书写词就是一段**
  （don't、John's 不拆开，点一下就是一个词），查词先查整段（常见缩约 ECDICT 有词条，如 don't、it's），
  查不到再由 `lemmaCandidates` 拆成「宿主词 + 缩约成分」或「名词 + 所有格」。

### 5. 句法与语法：中文母语者的难点

| 难点 | 为什么难 | 以后的课程、练习怎么照顾 |
|---|---|---|
| 时态与体（一般 / 进行 / 完成 / 完成进行 × 现在 / 过去 / 将来） | 中文靠「了、过、着」和时间词，动词不变形；最常见的错是漏第三人称单数、漏过去式、现在完成时与一般过去时混用 | 时态填空、选时态、找错 |
| 冠词 a / an / the / 零冠词 | 中文没有冠词 | 冠词选择题 |
| 可数与不可数（information、advice、furniture；a piece of） | 中文名词不分 | 判断可数、量词搭配 |
| 主谓一致 | 中文动词不随主语变 | 选正确的谓语形式 |
| 介词与搭配（in / on / at；make a decision、do homework） | 跟中文对不上 | 介词填空、搭配选择 |
| 短语动词（give up、look after、put up with） | 意思不是字面相加 | 短语动词意思题 |
| 非谓语动词（to do / doing / done）、从句、被动语态、虚拟语气、倒装 | 中文没有对应形式 | 语法填空（高考题型）、句型转换 |
| 词性转换（-tion、-ness、-ly、-ful……） | 高考「语法填空」、四六级「选词填空」都考 | 用词的适当形式填空 |
| 一词多义（get、take、make）、近义词 | 常用词义项极多 | 义项选择、辨析（ECDICT resemble.txt） |

### 6. 词汇与分级

- 词汇量巨大：ECDICT 基础版就有 77 万条（其中 37 万是词组，绝大多数是专业术语与专名），
  必须按词频、词表挑：学习者要的词全收，冷僻术语、专名、过长的词组不收。
- 中文用户最熟悉的是**考试词表**（中考、高考、四六级、考研、雅思、托福、GRE），背单词多半按它——
  所以除了主分级 CEFR，单设一套「中国考试词表」。

### 7. 跟日语的做法比

| 日语的做法 | 英语 |
|---|---|
| 正文注振假名 | 不注；以后可选在词上方注 IPA |
| 五十音逐个学 | 字母不用逐个学，改学拼读规则（`alphabet: 'phonics'`） |
| JMdict（英文释义）+ 机器翻译的中文 | ECDICT 本身就是英汉双解（中文释义人工整理，MIT），**不需要机器翻译，也不需要 zh-todo** |
| deinflect 规则一层层还原 | 变形表为主（几万个词形），规则兜底 |
| kuromoji 分词 | Intl.Segmenter + 英语的后处理（连字符复合词并成一段、缩写的点、'em 这类前撇号） |
| JLPT 五级 | CEFR 六级（主分级）+ 中国考试词表 + NGSL 系列词表 + 柯林斯星级 |
| 汉字页（笔顺、音训） | 没有；以后考虑「词根词缀」（ECDICT wordroot.txt） |
| 声调（Kanjium） | 重音（IPA 里的 ˈ ˌ）与弱读（`x.weak`） |
| 一种日语语音 | 美式（en-US）、英式（en-GB）两种语音，跟两套 IPA 对应 |
| 中文例句：Tatoeba 日中对照 + Tomoshi 机器翻译 | Tatoeba 英中对照（人工翻译 7.8 万对），繁体句用 Tatoeba 自带的简体转写 |

## 二、资料清单

### 阶段一用上的

| 资料 | 许可 | 地址 | 取了什么 | 能否再分发 |
|---|---|---|---|---|
| ECDICT（ecdict.csv 基础版，77 万条） | MIT（© Linwei / skywind3000） | https://github.com/skywind3000/ECDICT | 词头、音标（英式为主，作英式 IPA 的后备）、英文释义（多出自 WordNet）、中文释义、柯林斯星级、牛津 3000 标记（只当挑词的依据）、考试标签、BNC 与当代语料库词频名次、变形（exchange） | 可以，署名 |
| ECDICT lemma.en.txt（词形 → 原形，18.6 万个词形） | 文件头写「free to use for any research and/or educational purposes」，仓库整体 MIT | 同上 | 补 exchange 没有的词形 | 本软件是免费的学习软件，在教育用途之内；写进来源说明 |
| CEFR-J Wordlist 1.6（2020-03-24） | 免费用于研究、教育与商用，须注明出处；版权归东京外国语大学投野由紀夫研究室 | http://www.cefr-j.org/download.html | A1–B2 的等级（7,801 项按词性分，6,868 个词头）、主题分类 | 可以，按要求引用：*The CEFR-J Wordlist Version 1.6. Compiled by Yukio Tono, Tokyo University of Foreign Studies.* |
| Octanove Vocabulary Profile C1/C2 1.0 | CC BY-SA 4.0 | https://github.com/openlanguageprofiles/olp-en-cefrj | C1 1,111 项、C2 1,025 项 | 可以 |
| NGSL 系列：NGSL 1.2、NGSL-Spoken 1.2、NAWL 1.2、TSL 1.2、BSL 1.20、NDL 1.1 | CC BY-SA 4.0（Browne, Culligan, Phillips） | https://www.newgeneralservicelist.com/ | 通用核心词、口语核心词、学术词、托业词、商务词、初级读物高频词 | 可以 |
| ipa-dict en_US | MIT（数据出自 cmudict-ipa / CMUdict） | https://github.com/open-dict-data/ipa-dict | 美式 IPA（12.6 万词，含弱读式） | 可以 |
| Britfone 3.0.1 | MIT（© Jose Llarena） | https://github.com/JoseLlarena/Britfone | 英式（RP）IPA（1.6 万词，主次重音，弱读式） | 可以 |
| Tatoeba | CC BY 2.0 FR | https://tatoeba.org/ （导出：downloads.tatoeba.org/exports/per_language/） | 英语句子 204 万句（自报母语者写的 153 万句）、英中对照 7.8 万对、中文句子与它们的简繁转写、句子标签（挡掉不合适的句子） | 可以，署名 Tatoeba contributors |
| Windows 语音 | 系统自带 | — | 朗读（本机有 en-US、en-GB） | — |

### 调研过、以后的阶段用

- **kaikki.org 的英语维基词典**（wiktextract，CC BY-SA 4.0 / GFDL）：3.1 GB（gzip 后 523 MB），这台电脑
  单线程 60 KB/s，分 12 段并行在后台下。有完整变形表、IPA、录音文件名、义项标签（粗俗、冒犯、方言……）、
  例句。**阶段一不依赖它**；下完以后可选用来补录音地址与义项标签。
- **维基共享资源 / Lingua Libre 的英语录音**（En-us-*.ogg、LL-Q1860 开头的文件；CC BY-SA / CC0，
  一个文件一个许可）：这台电脑能连，但**中国大陆不翻墙连不上 upload.wikimedia.org**，所以没有录音也要能用
  （Windows 语音兜底）。
- **CEFR-J Grammar Profile**（20180315 版，部分已译成英文；cefr-j.org 另有 2025-02 的完整版）：许可同
  CEFR-J。阶段二认语法点、阶段四语法课的分级参考。已下载到缓存。
- **ECDICT wordroot.txt**（词根词缀）、**resemble.txt**（近义词辨析）：MIT；阶段三的词根词本、阶段四的辨析。
- **CMUdict**（BSD-2）：ipa-dict 美式的上游（ARPAbet），暂时不需要。
- **ipa-dict en_UK**：GPL-3.0（由 ipacards 转来，eSpeak 风格，重音符号标在元音前），不用；
  英式用 Britfone（MIT）+ ECDICT 音标。
- **VarCon**（英美拼写对照）：原站 wordlist.aspell.net 已失效（404），SCOWL 仓库也改版了；英美拼写改从
  CEFR-J 的并列写法里取。

### 不用的

| 资料 | 为什么 |
|---|---|
| English Vocabulary Profile（剑桥） | 只能在线查，不能再分发 |
| 牛津 3000 / 5000 | ECDICT 有「牛津 3000」标记，但这是牛津大学出版社编选的词表（Oxford 3000 还是商标），单列一套分级等于原样再分发它的编选成果；只在挑词时当作「收录」的依据之一，界面上不出现 |
| Kelly 词表、EFLLex | CC BY-NC-SA（非商用），能不用就不用 |
| Coxhead 的 AWL | 许可不明，学术词改用 NAWL（CC BY-SA） |
| COCA 词频表 | 商业许可；词频用 ECDICT 里的 BNC 与当代语料库名次 |
| Tatoeba 上 CK 的句子录音（83.5 万条，占英语录音的 98%） | CC BY-NC-ND 3.0；CC BY / BY-SA 的录音只有约 7 千条，以后可选 |

### 新闻与文本（阶段二用；2026-10-09 从这台电脑实际请求过）

**开放许可、可以收全文的：**

| 来源 | 许可 | 请求结果 | 说明 |
|---|---|---|---|
| VOA Learning English（40 多个栏目的 RSS，如 As It Is、Science & Technology、Health & Lifestyle、Words and Their Stories、American Stories、Everyday Grammar） | 公有领域 | 200，但**最新一条停在 2025-03** | 美国之音 2025 年 3 月起停止更新。当作公有领域的**存档**：几千篇分级文章（慢速、限定词汇）+ MP3 + 文稿；RSS 只有标题与一句简介，全文要抓文章页 |
| 英文维基新闻 | 2005-09-25 至 2024-12-15 的稿 CC BY 2.5，之后 CC BY 4.0 | 网站 200；**2026-05-04 起只读**（维基媒体基金会关闭了全部语种的维基新闻），NewsFeed 已撤，API 还能用 | 当存档（约 2 万篇） |
| Global Voices | CC BY 3.0 | 200，15 条，全文在 content:encoded（平均约 9,500 字符），当天有更新 | ✔ 每日新闻全文 |
| The Conversation（global / us / uk） | CC BY-ND 4.0 | 200，各 50 条，全文（平均 9,000–14,000 字符），当天有更新 | ✔ 学者写的评论与科普（B2–C1）；ND = 正文不能改：原样显示（下划线、查词叠加在上面），不删改、不做改写版 |
| NASA 新闻 | 公有领域 | 200，10 条，全文（平均 4,300 字符） | ✔ 科技 |
| 维基百科「新闻动态」（Portal:Current events，按日一页） | CC BY-SA 4.0 | API 200 | ✔ 每天几十条一句话的新闻，可做「每日要闻」 |
| 维基百科每日特色条目 / 历史上的今天（featuredfeed） | CC BY-SA 4.0 | 200 | 每天一篇长摘要（C1） |
| Our World in Data | CC BY 4.0 | 200，只有摘要，全文在网页 | 数据类长文 |
| Mongabay | CC BY-ND 4.0 | 200，部分正文 | 环境新闻 |
| Simple English Wikipedia | CC BY-SA 4.0 | API 200 | B1 左右的百科读物 |
| NIH News in Health | 公有领域 | 403（拒绝脚本访问） | 不用 |

**有版权、只收标题与导语（附原文链接，日语 NHK 的做法）：**
BBC（总览、国际、科学、科技各栏目，200）、NPR（200）、卫报（200；导语平均约 900 字符，偏长要截到完整的一两句）、
纽约时报（200）、半岛电视台英文（200）、天空新闻（200）、ABC 澳大利亚（200）、CBC（200）、
CGTN（200；RSS 里有全文，但有版权，只取导语）、南华早报（200）、日本时报（200，约 10 秒）、
联合国新闻（200）、Science News Explores（200；青少年科普）。

**取不到或不能用：** AP（403）、Breaking News English（403）、News in Levels（Access Restricted）、
中国日报 RSS（404，地址变了）、新华社英文 RSS（停在 2018 年）、环球时报（停在 2026-08、没有导语）、路透社（已无 RSS）。

**播客：** BBC Learning English「6 Minute English」（200，344 期，有 MP3 地址），有版权：只放标题、简介与原链接；
软件里能不能直接播放官方播客地址（不缓存、不转存），要主线定。

**公有领域 / 开放许可的文本（阅读、故事课）：**

- 古登堡计划（美国公有领域；200，偶尔超时）：伊索寓言（Townsend 译本，1867）、格林童话（Lucy Crane 译本，1882）、
  安徒生（H. P. Paull 译本，1872；Hersholt 译本 1949 年出版、仍有版权，不用）、王尔德《快乐王子》、
  吉卜林《原来如此》、波特《彼得兔》、《爱丽丝漫游奇境》、**McGuffey 分级读本**（1879，本身就是分级读物）……
- Standard Ebooks（公有领域作品的 CC0 整理本，有 RSS）：200。
- StoryWeaver（Pratham Books，CC BY 4.0，分 1–4 级的儿童故事，有 API）：200。
- African Storybook、Global Storybooks（CC BY 4.0，分级儿童故事，部分带录音）：200。
- LibriVox（公有领域有声书，有 API）：200；阶段六视听用。
- 英文维基文库（公有领域文本）：200。

### 考试（阶段五用，先记下结构）

- **CEFR 与剑桥五级**：A2 Key（KET）、B1 Preliminary（PET）、B2 First（FCE）、C1 Advanced（CAE）、
  C2 Proficiency（CPE）；KET、PET 分阅读与写作、听力、口语三份卷，FCE 起分阅读与语言运用（Reading and Use of
  English）、写作、听力、口语四份卷；语言运用部分有完形选择、开放完形、构词填空、句子改写。
- **大学英语四级**：写作 15%（30 分钟）、听力 35%（短篇新闻、长对话、听力篇章共 25 题）、阅读 35%（选词填空 10、
  长篇阅读匹配 10、仔细阅读 10，40 分钟）、翻译 15%（汉译英段落，30 分钟）；满分 710，425 分是报考六级的线。
  **六级**结构相同，难度高。
- **雅思**：听力 4 部分 40 题约 30 分钟；阅读 3 篇 40 题 60 分钟；写作 2 题 60 分钟；口语 11–14 分钟；
  0–9 分、半分一档；对 CEFR：B1 4.0–5.0、B2 5.5–6.5、C1 7.0–8.0、C2 8.5–9.0。
- **托福 iBT（2026-01-21 起的新版）**：四部分共约 90 分钟，阅读与听力分段自适应；每部分 1–6 分（0.5 一档），
  总分取平均，1–6 对 CEFR A1–C2；2026–2028 过渡期成绩单同时给旧的 0–120 分。阅读：Complete the Words（补全单词字母）、
  Read in Daily Life（邮件、通知等短文）、Read an Academic Passage；写作：Build a Sentence（连词成句）、Write an Email、
  学术讨论；口语：Listen and Repeat、Take an Interview。
- **高考（新课标卷）**：150 分。听力 30（20 题）、阅读 50（阅读理解 15 题 + 七选五 5 题）、语言运用 30
  （完形填空 15 题、语法填空 10 题）、写作 40（应用文 15、读后续写 25）。
- **考研英语（一）**：完形 20 题 10 分、阅读 A 节 20 题 40 分、B 节（新题型）10 分、英译汉 10 分、
  小作文 10 分、大作文 20 分，共 100 分、180 分钟。
- 中考各地自主命题，不做统一卷，按中考词表出题。

## 三、分级

四套，主分级是 CEFR（`spec.ts` 的 `levelSystems`）：

### 1. CEFR A1–C2（主分级，`cefr`）

- **A1–B2：CEFR-J Wordlist 1.6**。它按词性给级（color 名词 A1、动词 A1；close 形容词与动词不同级）；
  词条按词头合并，所以词条的级取各词性里最低（最容易）的一级，各词性的级另存 `x.cefrPos`。
  「color/colour」「a.m./A.M./am/AM」这种并列写法拆开，每种写法都给这一级。
- **C1–C2：Octanove Vocabulary Profile 1.0**。同一个词在 CEFR-J 里已有级的，以 CEFR-J 为准。
- **两表都没有的：按词频补。** 构建时用已分级的词在 ECDICT 词频名次（BNC 与当代语料库取较小的那个）上的分布
  算出切点，只给没有分级的词补级（数据见文末「进度」里的构建记录）。
- 官方数字对照：CEFR-J 1.6 品词别 A1 1,166、A2 1,411、B1 2,445、B2 2,779 项（词头 1,068 / 1,352 / 2,353 / 2,692）；
  Octanove C1 1,111、C2 1,025 项。

### 2. 中国考试词表（`cn-exam`，词表）

ECDICT 的 tag 字段：中考 zk、高考 gk、四级 cet4、六级 cet6、考研 ky、雅思 ielts、托福 toefl、GRE gre。
ECDICT 全库里的数目：中考 1,603、高考 3,677、四级 3,849、六级 5,407、考研 4,801、雅思 5,040、托福 6,974、GRE 7,504。
一个词可以同时在几张表里。

对照官方要求（ECDICT 的表跟官方大纲的口径不完全一样，界面说明里写清）：

- 中考：《义务教育英语课程标准（2022 年版）》词汇表 1,600 词（二级 505 + 三级 1,095），三级可拓展到 1,800 + 200。
- 高考：《普通高中英语课程标准（2017 年版 2020 年修订）》必修累计 2,000–2,100 词，选择性必修累计 3,000–3,200 词。
- 四级：约 4,500 词（含中学词汇）+ 700 词组；六级：约 5,500 词 + 1,200 词组（《大学英语课程教学要求》）。
- 考研：大纲约 5,500 词。
- 雅思、托福、GRE 没有官方词表，ECDICT 的是常见备考词表的汇总。

### 3. NGSL 系列（`ngsl`，词表）

NGSL 项目（Browne 等，CC BY-SA 4.0）按语料库统计、为学习者挑的几张核心词表：
NDL（初级读物高频词）、NGSL-Spoken（口语核心 721 词）、NGSL（通用核心 2,809 词，覆盖一般文本约 92%）、
TSL（托业）、BSL（商务）、NAWL（学术 963 词）。

### 4. 柯林斯星级（`collins`，词表）

ECDICT 的 collins 字段（1–5 星，五星最常用；ECDICT 全库：五星 630、四星 1,009、三星 1,418、二星 3,036、一星 7,540）。
星级源自柯林斯 COBUILD 按语料库统计的词频分档，ECDICT 以 MIT 发布；它是统计出来的词频档（事实性数据），
跟编选的词表不同，所以收了，来源里写明出处。**如果主线觉得有风险，删掉这一套只要改 spec.ts 和管线里的一处。**

## 四、词典数据库里英语自己的约定

- **词条**：ECDICT 一个词头一条（不分词性）。义项按 ECDICT 中文释义的行：一行是一个词性的一组释义，
  拆成一个义项（`zh` 几条），同词性的英文释义（WordNet）挂到这个义项的 `en`；带领域标记的行（[医]、[计]、[法]……）
  放在后面、标 `dom`；[网络] 释义只在没有别的中文时用。
- **词性**：n. → noun，v. / vt. / vi. → verb，a. / adj. → adj，ad. / adv. → adv，prep. → adp，
  conj. → cconj（because、if、although 这类改 sconj），pron. → pron，int. / interj. → intj，num. → num，
  art. → det，abbr. → abbr，pref. / suf. → affix；多词的词组 → phrase。
- **变形**（`f`）：ECDICT exchange 对到 Wiktextract 标签——p 过去式 `past`、d 过去分词 `past participle`、
  i 现在分词 `present participle`、3 第三人称单数 `third-person singular present`、r `comparative`、
  t `superlative`、s `plural`；lemma.en.txt 里多出来的词形按词尾推标签。
- **`x` 的键**：
  - `ipaUk`、`ipaUs`：英式、美式 IPA（`ipa` 是两者合起来、英式在前）
  - `weak`：功能词的弱读式
  - `var`：另一种拼写（英美拼写）
  - `cefrPos`：各词性的 CEFR 等级（来自 CEFR-J / Octanove）
  - `exp`：缩约的完整形式（don't → do not）
- **来源 id**：`ecdict`、`ecdict-lemma`、`cefrj`、`octanove`、`ngsl`、`ipadict`、`britfone`、`tatoeba`、`cefr`。
- **不适合学习软件的内容**：按标记用程序挡——ECDICT 释义里的粗俗、侮辱、冒犯标记（中文的〈粗〉〈讳〉之类、
  英文释义里的 obscene / vulgar / offensive / disparaging 等），带这类标记的义项不收，整条都是这类义项的词条不收；
  例句用 Tatoeba 的句子标签和挡掉的词条来挡。词表、文档里都不写出这些词。

## 五、后面各阶段的打算

- **阶段二 阅读与新闻**：切词用 `rules.tokenize`；阅读器按 CEFR 画下划线；查词先查整段（缩约、连字符复合词），
  再按 `lemmaCandidates`；词组（phrasal verbs、固定搭配）在句子里认出来高亮（按原形序列匹配，允许中间插入宾语）；
  语法点参考 CEFR-J Grammar Profile 分级、说明与例句自己写；新闻：Global Voices、The Conversation、NASA、
  维基百科新闻动态（全文），BBC、NPR、卫报等（标题 + 导语）；内置文章：VOA Learning English 存档与古登堡的
  公有领域故事、McGuffey 分级读本；文章难度按用词的 CEFR 分布估。可选在词上方注 IPA。
- **阶段三 生词本**：内置词本 = CEFR 各级、中国考试词表（中考 → GRE）、NGSL 系列、柯林斯星级；主题词本用
  CEFR-J 的主题分类（Core Inventory / Threshold，比如 Food and drink、Travel、Work and jobs）；另做「不规则动词」
  「短语动词」「英美拼写」「词根词缀」词本（由脚本从数据生成）。
- **阶段四 课程**：拼读规则（phonics，不是逐个字母）、音标（英式、美式两套对照）、重音与弱读；
  语法按 CEFR 分课（时态、冠词、可数不可数、从句……）；变形课（不规则动词、复数、比较级，表由脚本生成）；
  会话课；短语动词与习语课；故事课（伊索、格林、安徒生的公有领域译本）。
- **阶段五 练习与模拟卷**：题型按英语的难点（时态、冠词、主谓一致、介词、短语动词、词性转换、拼写听写、
  重音位置、弱读听辨）；模拟卷按 CEFR 级照剑桥五级的卷面缩短，另做四六级式（听力、阅读选择部分；写作翻译不评分）。
- **阶段六、七 视听与统计**：字幕逐词查词沿用切词与查词；LibriVox 有声书、VOA 存档的 MP3 可做内置材料。
- **阶段八 补齐**：补录音地址（维基共享资源，可选）、补齐 C1–C2 语法与练习。

## 六、进度

- 2026-10-09：资料调研完成（上面的清单），原始数据下载到 `.cache/data/en/`；下一步写 spec / rules 与数据管线。
