# 法语（fr）

> 2026-10-12 进度更新：已接入阅读、语法词典、六类课程、本文练习、自测卷、字幕查词、录音与统计。
> 当前 60,904 个词条、60 个语法点、120 个双语教学例句、6 篇读物、6 套自测卷。
> 拼读、省音/联诵、性数一致、代词与语气；中文释义继续补译。
> 下文的「阶段一」「要框架做的」为历史记录；现行范围、限制和下一阶段以 [多语言进度](../multilingual-progress.md) 为准。

分支 `lang/fr`，工作目录 `Documents\GitHub\Qonsona-wt\fr`。约定见 [lang-kit.md](../lang-kit.md)。
这份文档随做随记：进度、来源、待定问题都在这里，中断了别人能接着做。

## 进度

| 阶段                     | 状态                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| 一：资料、特点与词典数据 | **完成**（10-10）：规则与单测、数据管线、词典库 105 MB / 60,417 词条（过校验）、分级、文档 |
| 二：阅读与新闻           | 未开始；新闻源已逐个实测（见「资料清单 · 新闻」），打算见「后面各阶段」                    |
| 三～八                   | 未开始                                                                                     |

### 进度日志

- 10-09 18:40 起：读约定、调研资料、下载原始数据（`.cache/data/fr/`，约 3.6 GB）。
- 10-09 19:20：`rules.ts`（查词键、宽松键、切词、猜原形）与 13 个测试。
- 10-09 23:15：额度恢复后接着做；合并 main（通用词典、阅读、生词本、课程接口）。
- 10-09 23:30–10-10 00:20：数据管线、第一版词典（过校验）；排名清理、分级按 FLELex 校准、虚词中文手写、中文对义项收紧。
- 10-10 09:30：合并 main（fi / alt、补译流水线、lang-smoke）；补上变形读音 fi、同一词形的几种可能（不再给查词键去重）；
  `lang-smoke.mjs fr`（端口 9412，隔离实例）9/9 通过。

### 怎么重建

```sh
node scripts/data/run-ts.mjs scripts/data/fr/download.ts     # 原始数据，约 3.6 GB，已有的跳过（12 路分段并行、断点续传）
node scripts/data/run-ts.mjs scripts/data/fr/build.ts        # 建库，中间结果有缓存（.cache/data/fr/work/），再跑二三十秒
node scripts/data/run-ts.mjs scripts/lang/validate.ts fr     # 校验
node scripts/data/run-ts.mjs scripts/data/fr/levels-check.ts # 跟 FLELex 比分级（只在本机）
node scripts/data/run-ts.mjs scripts/data/fr/stats.ts        # 各级词数、中文覆盖、来源
node scripts/data/run-ts.mjs scripts/data/fr/tags-check.ts   # 界面还没有中文叫法的标签
node scripts/data/run-ts.mjs scripts/data/fr/debug-zh.ts chat livre   # 看一个词的中文候选从哪来
npx vitest run tests/lang/fr
```

软件开着时 `dict.sqlite` 被占用换不掉：`build.ts --out <别处>`，校验时把路径写在 `fr` 后面。
**规则（rules.ts 的 key / looseKey）改了要重建库。英文释义的写法定了，别再改**（主线的补译按「词头 + 词性 + 英文释义」对）。

## 待定（需要用户或主线拍板；先按括号里的默认做法做了）

1. **FLELex 是 CC BY-NC-SA 4.0**（核实于官网下载页）。它是法语 CEFR 分级词表里最好的（按 FLE 教材统计）。
   约定说 NC 的能不用就不用。**默认：不进库**，只在本机用来校准、核对按词频切的级别（`levels-check.ts`，见「分级」）。
   若认为软件免费、非商用可以接受 NC，可以改成直接用 FLELex 的级别（要在来源里写明 NC，整个库的分级数据随之成为 NC）。
2. **CFDICT 的许可要求「在应用里和应用的介绍页上都注明来源网站 https://chine.in」**。应用里：设置的「数据来源与许可」
   已经列出（来源 `cfdict` 的署名里写了网址）。**介绍页（README、发布说明）也要加一行**——主线的文件。
3. 维基共享资源的录音许可逐个文件不同：Lingua Libre 的（文件名 `LL-Q150 (fra)-…`，九成以上）一律 CC BY-SA 4.0，
   `au.credit` 写了「Lingua Libre · 录音者」；其余写「Wikimedia Commons」，许可以文件页为准。kaikki 的数据里没有逐个文件的许可，
   要逐条写全得批量查 Commons API（这台电脑连 Commons API 会被限速 429）。**默认：现在这样**。
4. 动词的组沿用法语维基词典的分类（aller 算第三组）；`cls` 写的是法语原文「1er groupe / 2e groupe / 3e groupe」，
   界面没有中文叫法时就显示原文（见「要框架做的」）。

## 一、法语的特点（跟日语哪里不一样）

### 文字与拼写

- 拉丁字母加变音符号：é è ê ë à â î ï ô û ù ü ÿ ç，连写字母 œ æ。重音符号会改读音（é /e/、è /ɛ/），
  也区分词（a / à、ou / où、du / dû、la / là、sur / sûr）。键盘打不出时宽松键能查到（`eleve` → élève，`coeur` → cœur）。
- 1990 年的拼写改革（rectifications orthographiques）以后两种写法都对：paraître / paraitre、oignon / ognon、
  événement / évènement。维基词典把新写法收成异体，进了变形表；去掉长音符的写法宽松键也能对上。
- 星期、月份、语言、国籍形容词小写（lundi、janvier、le français），国名、国籍名词大写（la France、un Français）。
- 标点：; : ! ? 和书名号 « » 前后有（窄）不换行空格。查词键把各种空格都规整成普通空格。
- 省音（élision）：le la de je me te se ne que si（si 只在 il / ils 前）在元音和哑音 h 前写成 l' d' j' m' t' s' n' qu' s'，
  跟后面的词连写：l'homme、qu'il、s'il。**切词要拆开**，但 aujourd'hui、jusqu'à、quelqu'un、presqu'île、prud'homme 是一个词。
- 连字符：倒装（dit-il、a-t-il，-t- 是为读音加的）、肯定命令式（donne-le-moi、va-t'en）挂的代词要拆；
  复合词（porte-monnaie、après-midi、peut-être、arc-en-ciel、vingt-deux）不拆；celui-ci、jusque-là 是一个词。

### 发音

- **看拼写大多能读出来（拼读规则相当有规律），反过来听音写字很难**：同音词多（vert / verre / ver / vers / vair；
  sans / sang / cent / s'en），词尾辅音多半不发音（c r f l 常发音），复数 -s、动词 -ent 不发音
  （mange、manges、mangent 都读 /mɑ̃ʒ/）。
- 鼻化元音 /ɑ̃ ɛ̃ ɔ̃ œ̃/（an / en、in / ain、on、un），没有鼻辅音收尾——中文的 -n / -ng 是带辅音的，容易读成「昂」「安」。
- 前圆唇元音 /y ø œ/：/y/ 中文有（ü），/ø œ/ 难；e muet /ə/ 时有时无。
- 小舌音 /ʁ/。清浊对立 /p t k/–/b d g/：法语清塞音不送气，中文母语者容易把它听成、读成 b d g。
- **连诵（liaison）、联诵（enchaînement）、省音**：les amis /le.z‿a.mi/、un grand homme /œ̃ ɡʁɑ̃.t‿ɔm/。
  有必须连、禁止连（et 后面、h aspiré 前面）、可连可不连三种。h aspiré（le héros、les haricots）既不省音也不连诵——
  词典里标在 `x.h`（424 个词条）。
- 重音落在节奏组的最后一个音节，不在单词上；句子听起来是一串音节，词界模糊，听力难在「切不开」。
- 数字 70–99 用二十进制（soixante-dix 70、quatre-vingts 80、quatre-vingt-dix 90）；比利时、瑞士说 septante、nonante。

### 形态

- **名词有阴阳性**，无生命的也有，大多没道理可讲（la table、le bureau）；有些靠词尾能猜（-tion、-té 阴性，-ment、-age 阳性）。
  同形不同性不同义：le livre「书」/ la livre「磅」，le tour「圈」/ la tour「塔」，le poste「职位」/ la poste「邮局」。
- 冠词：定冠词 le la l' les，不定冠词 un une des，**部分冠词** du de la de l' des（不可数的「一些」），否定句里变 de；
  介词缩合 au aux du des。中文没有冠词，部分冠词尤其难。
- 形容词跟名词性数配合（grand / grande / grands / grandes），多数放名词后，常用的几个放前面（beau、bon、grand、petit、
  jeune、vieux……）；beau / nouveau / vieux 在元音前变 bel / nouvel / vieil。
- **动词变位**：每个时态六个人称形，分三组（-er 规则、-ir（-issons）规则、第三组不规则）。常用动词几乎都不规则（être avoir
  aller faire pouvoir vouloir devoir savoir venir prendre mettre dire voir）。
  - 语式与时态：直陈式（现在时、复合过去时 passé composé、未完成过去时 imparfait、愈过去时、简单过去时 passé simple〔只在书面〕、
    简单将来时、先将来时……）、虚拟式（现在时为主；未完成过去时只在文学里）、条件式、命令式，加分词与副动词（en + 现在分词）。
  - 复合时态用 avoir 或 être 加过去分词：表示移动、状态改变的十几个动词和所有代词式动词用 être——词典里写在 `x.aux`（6,171 个动词）。
    过去分词的配合（跟 être：配主语；跟 avoir：配前置的直接宾语）是母语者也常错的地方。
- 代词式动词（se lever、s'appeler）：se 跟着人称变（je me lève）。

### 句法

- 主谓宾，但**宾语代词放在动词前**（je le lui donne），顺序固定（me/te/se/nous/vous > le/la/les > lui/leur > y > en），
  肯定命令式放后面（donne-le-moi）。代词 y（代替 à + 补语、地点）、en（代替 de + 补语、数量）中文里没有对应的。
- 否定 ne … pas（口语常丢 ne）、ne … jamais / plus / rien / personne / que。
- 疑问三种：语调、est-ce que、主谓倒装（Vient-il ? A-t-il fini ?）。
- 关系代词 qui / que / dont / où / lequel；虚拟式由主句的意思触发（il faut que、vouloir que、bien que……）。
- 称呼的 tu / vous 区分亲疏。

### 中文母语者的难点（按出现的先后）

1. 读音：鼻化元音、/ø œ ʁ/、清浊、e muet；**听力**被连诵、省音、不发音的词尾搅得切不开词；听写尤其难。
2. 名词的性，和一切跟着它变的东西：冠词、形容词、代词、过去分词。
3. 冠词，尤其是部分冠词与否定句里的 de。
4. 动词变位的量（每个动词几十个形），和时态的选择：复合过去时与未完成过去时（中文用「了、过、着」只对得上一部分）。
5. 宾语代词的位置与顺序，y 和 en。
6. 虚拟式、条件式的用法；书面语的简单过去时（读小说要认得）。
7. 数字 70–99，日期、时间的说法。

### 跟日语的做法哪里不一样

|          | 日语                             | 法语                                                                                                                                                                               |
| -------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 切词     | 要分词器（kuromoji）             | 有空格，但省音、倒装和命令式的连字符要专门处理（`rules.ts` 的 `tokenize`）                                                                                                         |
| 注音     | 振假名 / 罗马字                  | 不需要振假名。阶段二打算开 `ruby: 'ipa'`：每个词注 IPA，变过形的用 `fi` 里这个形的读音（mangent /mɑ̃ʒ/），提醒不发音的词尾                                                          |
| 汉字     | 汉字页、手写查字                 | 没有；代之以**变形表**（动词 50 多个形、名词形容词的性数），词典、阅读、练习都靠它                                                                                                 |
| 查词     | 原形、读音、罗马字               | 原形、任何变位形（452,683 个严格键）、去重音的宽松键、猜原形；中文、英文释义反查                                                                                                   |
| 分级     | JLPT N5–N1                       | CEFR A1–C2（DELF / DALF / TCF）                                                                                                                                                    |
| 练习重点 | 读法、汉字、助词                 | **性、冠词、变位、配合**（框架已有「名词的性」「变形」题型，数据已经够）                                                                                                           |
| 朗读     | Windows 有日语语音               | 这台电脑没有法语语音；靠维基共享资源的真人录音（87% 的词条有，最多 4 个：法国〔巴黎优先〕、加拿大、比利时、瑞士、非洲各一）和 IPA；装了法语语音的电脑照常朗读（`speech: 'fr-FR'`） |
| 中文释义 | JMdict 英文 → 机器翻译 + Tomoshi | 维基词典（中文版的法语词条、法语版与英文版的译词表）+ CFDICT 反查 + 虚词手写；其余由主线补译                                                                                       |
| 变体     | —                                | 法国、比利时、瑞士、加拿大（魁北克）、非洲法语：义项上标 Quebec、Belgium、Switzerland、Africa、Louisiana                                                                           |

## 二、资料清单

全部在 10-09 从这台电脑实际请求过；下载的都在 `.cache/data/fr/`（不入库），旁边的 `*.json` 记着地址、ETag、下载时间，
库的 `meta.versions` 也记着各份的地址与 Last-Modified。

### 词典、词表（进了库的）

| id           | 资料                                                                                                | 许可                                                | 取了什么                                                                                                                                                                                               | 再分发                     | 大小                                     |
| ------------ | --------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- | ---------------------------------------- |
| wiktionary   | 英文维基词典的法语词条，kaikki.org（wiktextract）`dictionary/French/…jsonl.gz`，10-03 抽取          | CC BY-SA 4.0 / GFDL                                 | **词典的骨架**：词性、性、英文释义（简短、按义项分好）、语体标签、领域、IPA、变位与变格表（动词 64 格；「某词的变形」页 33.8 万个也并进原词）、录音地址、带英译的例句、近义反义                        | 可以（署名、相同方式共享） | 58 MB，40.3 万条记录 → 9.7 万个词条草稿  |
| frwiktionary | 法语维基词典的法语词条，kaikki `frwiktionary/Français/…jsonl.gz`，10-02                             | CC BY-SA 4.0 / 3.0                                  | 法语释义（单语 `mono`，55,985 个词条有）、按义项的中文 / 英文译词、h aspiré、动词的组、变位表的读音（`fi`）、Lingua Libre 录音；英文维基词典没有的常用词整条取自这里（1,195 条）                       | 可以                       | 392 MB，211 万条（大半是变位形式的页面） |
| wikt-zh      | 中文维基词典的法语词条（kaikki `zhwiktionary/法语`、`法語`）＋法语维基词典、英文维基词典的译词表    | CC BY-SA 4.0 / 3.0                                  | 人写的中文释义（29,328 个词条；繁体逐字转简体，从汉法词典导入的「n.m. … n.f. …」按词性标记切开）；英文维基词典的整份原始抽取里 37,057 个英语词条的翻译表同时有法语和普通话，得到 41,855 个法汉对照义项 | 可以                       | 4 MB + 5.8 MB + 2.98 GB                  |
| cfdict       | CFDICT 汉法词典（chine.in，David Houstin），`cfdict.u8`，版本 2024-12-14，5.6 万条                  | CC BY-SA 3.0，**要求在应用及其介绍页注明 chine.in** | 反查：法语释义整条等于这个词的中文词。只在维基词典没有中文的义项上补（3,484 个义项）；虚词不用                                                                                                         | 可以                       | 3.5 MB                                   |
| lexique      | Lexique 4.1（2026-09-29）与 3.83（lexique.org，New & Pallier 等）                                   | CC BY-SA 4.0                                        | 词频（4.1 的 3.16 亿词字幕语料 + 3.83 的书籍语料）→ 名次、分级；词形的 IPA（`fi` 的补充）；知晓率（暂未用）                                                                                            | 可以                       | 49 MB + 27 MB                            |
| tatoeba      | Tatoeba `per_language/fra`（10-03 导出）                                                            | CC BY 2.0 FR（部分 CC0）                            | 72.8 万法语句子里有翻译的 38.1 万句；进库 47,409 句（有中文的 20,277 句全收，其余按词挑最短最容易的，每词 3 句）；义项下的维基词典例句另有 10,205 句                                                   | 可以（署名）               | 9.8 MB 等                                |
| commons      | 维基共享资源的录音（多数是 Lingua Libre），地址取自维基词典                                         | Lingua Libre CC BY-SA 4.0；其余逐个文件             | `au`：mp3 转码地址、地区标签（统一写成「France (Paris)」）、录音者                                                                                                                                     | 只存地址，联网时播放       | —                                        |
| fr-core      | 本软件自编：A1、A2 核心词（`data/fr/core.txt`）、虚词的中文（`data/fr/zh-core.txt`，约 230 个义项） | CC0                                                 | 分级的补正、虚词释义                                                                                                                                                                                   | 可以                       | —                                        |

只在建库时用、不进库的：CC-CEDICT（CC BY-SA 4.0，中文词的英文意思，用来把中文对到义项上；繁转简的字表）、
结巴分词词频（MIT，中文候选排先后）、**FLELex（CC BY-NC-SA 4.0，只核对分级）**。

调研过、没用的：

- 法语维基词典的整份原始抽取（703 MB）：按语言分好的 `Français` 文件够用。
- Morphalou 3.1（ATILF，LGPL-LR，97 万词形）：维基词典的变位表已经全了，先不用。
- Dicollecte / Grammalecte 词库（MPL 2.0）：拼写检查用，没有词频。
- Gougenheim《Français fondamental》（1954）词表：OpenLexicon 上只有前 1,064 词的频率，出版物有版权。
- Éduscol「Liste de fréquence lexicale」（Étienne Brunet，约 1,500 词）：© 教育部，未开放许可。
- Manulex（小学课本分年级词频）：数据许可不明。
- Français interactif（得克萨斯大学奥斯汀分校的开放教材，**CC BY 3.0**）：13 章的词汇表可以做 A1–A2 的教材词表，
  但只有 PDF（两栏排版、英法交错），留给阶段三。
- Lingua Libre 自己的数据站（lingualibre.org、datasets.lingualibre.org）要 HTTP/2，curl 连不上；录音地址已经从维基词典拿到，不需要。

### 公有领域文本（阶段二的课文、故事）

- 法语维基文库（fr.wikisource.org，71.8 万篇，可连）：拉封丹《寓言》、佩罗《鹅妈妈故事》、都德《磨坊书简》《月曜故事》、
  莫泊桑短篇、凡尔纳、雨果……（《小王子》的作者圣埃克苏佩里有「为国捐躯」的版权延长，在法国仍受保护，不收。）
- 古登堡计划（可连；目录 `cache/epub/feeds/pg_catalog.csv.gz`，40 秒）。
- Ebooks libres et gratuits、Bibebook（公有领域作品整理本，可连；整理本身的许可要逐个看）。
- 法语维基新闻（CC BY 2.5，可收全文）：可连，但几乎停更，只能当存档文章用。
- Vikidia（儿童百科，CC BY-SA）：**从这台电脑连不上**（Cloudflare 人机验证 403），不绕过。

### 新闻（阶段二；10-09 从这台电脑逐个请求过）

有版权的只取 RSS 里的标题与导语，附原文链接（日语 NHK 的做法）。

| 来源                                          | RSS 地址                                                              | 结果                                                                |
| --------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------- |
| RFI 法语                                      | `https://www.rfi.fr/fr/rss`                                           | 200，24 条，有导语，1 秒                                            |
| RFI 非洲                                      | `https://www.rfi.fr/fr/afrique/rss`                                   | 200，24 条                                                          |
| RFI「简易法语新闻」Journal en français facile | `https://www.rfi.fr/fr/podcasts/journal-fran%C3%A7ais-facile/podcast` | 200，24 期，每期 10 分钟 mp3；文字稿在 RFI 网页上（有版权，只链接） |
| France 24                                     | `https://www.france24.com/fr/rss`                                     | 200，24 条，有导语                                                  |
| Le Monde 头条                                 | `https://www.lemonde.fr/rss/une.xml`                                  | 200，16 条，有导语                                                  |
| franceinfo                                    | `https://www.francetvinfo.fr/titres.rss`                              | 200，32 条（标题里有 HTML 实体，要解码）                            |
| 20 Minutes                                    | `https://www.20minutes.fr/feeds/rss-une.xml`                          | 200，30 条                                                          |
| Le Figaro                                     | `https://www.lefigaro.fr/rss/figaro_actualites.xml`                   | 200，19 条                                                          |
| Libération                                    | `https://www.liberation.fr/arc/outboundfeeds/rss-all/?outputType=xml` | 200，50 条                                                          |
| Ouest-France                                  | `https://www.ouest-france.fr/rss/une`                                 | 200，10 条                                                          |
| Radio-Canada（加拿大）                        | `https://ici.radio-canada.ca/rss/4159`                                | 200，20 条                                                          |
| RTBF（比利时）                                | `https://rss.rtbf.be/article/rss/highlight_rtbf_info.xml`             | 200，20 条                                                          |
| RTS（瑞士）                                   | `https://www.rts.ch/info/?format=rss/news`                            | 200，25 条                                                          |
| TV5Monde 资讯                                 | `https://information.tv5monde.com/rss.xml`                            | 200，100 条（1.4 MB，导语是 HTML，要清理）                          |
| 1jour1actu（儿童新闻）                        | `https://www.1jour1actu.com/feed`                                     | 403，不绕过                                                         |
| 法语维基新闻                                  | API `fr.wikinews.org/w/api.php`                                       | 可连，几乎没有新稿                                                  |

### 考试（阶段五）

- DELF A1–B2、DALF C1–C2（France Éducation international）：四项（听、读、写、说）各 25 分，总分 100，50 分及格且每项不低于 5 分。
  时长（概数）：A1 听 20′ 读 30′ 写 30′ 说 5–7′；A2 25′ / 30′ / 45′ / 6–8′；B1 25′ / 35′ / 45′ / 15′；B2 30′ / 60′ / 60′ / 20′（准备 30′），
  2023 年起的新版 B2 听力、阅读全是选择题；C1 听 40′ 读 50′ 写 2 h 30（综述 + 论证）说 30′（准备 1 h）；
  C2 听说合考、读写合考各 50 分。官网（france-education-international.fr）从这台电脑访问被人机验证挡住，以上照几个备考站点核对。
- TCF 全民版（TCF tout public）：听力、语言结构、阅读三项必考的选择题，写作、口语两项选考；100–699 分对应 A1–C2（每 100 分一级）。
  各项题数、时长各家写法有出入，做模拟卷前再核对。
- 模拟卷照 DELF 的卷面做听、读两项和词汇语法（写、说没法自动判分），按答对比例换算成 25 分制，写明「仅供参考」。

## 三、分级

### 主分级：CEFR A1–C2（DELF / DALF / TCF）

法语学习者通行的就是 CEFR：法国教育部的 DELF（A1–B2）、DALF（C1、C2）逐级考，TCF、TEF 的分数也换算成这六级。
各级说明（`spec.ts`）写了这一级能做什么、对应的 DELF / DALF 卷面与 TCF 分数段。

**词怎么分到各级**（`scripts/data/fr/levels.ts`）：

1. **按词频名次切**。名次来自 Lexique 的合成词频：字幕（Lexique 4.1，口语、日常）与书籍（Lexique 3.83，书面）
   取加权几何平均（0.6 : 0.4）——字幕单用会把 mec、putain、flic 排得太前，书籍单用会把文学词排得太前；
   跟 FLELex 比（同级的比例）：只按字幕 41.0%，合起来 41.4%，再加下面两步 42.9%。
   同形不同性的名词按 Lexique 的性分开（le livre 比 la livre 常用得多）；介词、感叹词等同形词不借整个词的词频。
2. **切点**：拿 FLELex/Beacco 版（按 FLE 教材统计、对照《法语参考水平》定级的 14,236 个原形）当参照，
   在我们的名次里找位置，使这个位置之前的 FLELex 词数正好等于 FLELex 到这一级为止的词数（`levels-check.ts`）：
   A1 ≤ 1,400、A2 ≤ 2,150、B1 ≤ 4,200、B2 ≤ 12,500、C1 ≤ 22,800、C2 ≤ 40,000（照算 C2 是 51,545，但 4 万名以后多是专业词，不分级）。
   **FLELex 只用来定这六个数和核对，词表本身不进库**（NC 许可）。
3. **手挑的核心词**（`data/fr/core.txt`，本软件自编）：按 DELF A1、A2 的话题（问候、数字、时间、家庭、身体、颜色、饮食、衣物、
   住房、城市、交通、学校、职业、天气、休闲、购物、健康、旅行……）和全部代词、冠词、限定词、常用介词连词，取「词频的级」和「这里的级」
   里容易的那个——stylo、cahier、gomme、mardi 在字幕里不常见，只按词频会落到 B1、B2。
4. **语体下限**：义项全是粗俗、冒犯的至少 B2，全是口语、俚语的至少 B1，全是古旧、书面、罕用的至少 C1。

**各级词数**（10-10 的库）：

| 等级   | 词条   | 累计   | 有中文 | 有录音 | FLELex/Beacco 这一级 | Milton (2010) 法语学习者认识的词（XLex，只测最常用的 5,000 词） |
| ------ | ------ | ------ | ------ | ------ | -------------------- | --------------------------------------------------------------- |
| A1     | 1,626  | 1,626  | 97%    | 99%    | 1,247                | 约 900–1,500                                                    |
| A2     | 768    | 2,394  | 95%    | 98%    | 679                  | 约 1,700–1,750                                                  |
| B1     | 1,927  | 4,321  | 91%    | 97%    | 1,753                | 约 2,200–2,400                                                  |
| B2     | 8,160  | 12,481 | 80%    | 96%    | 5,088                | 约 2,450–2,650                                                  |
| C1     | 10,369 | 22,850 | 63%    | 92%    | 3,155                | 约 2,700–3,200                                                  |
| C2     | 17,195 | 40,045 | 49%    | 90%    | 2,314                | 约 3,500–3,700                                                  |
| 不分级 | 20,372 |        | 54%    | 76%    |                      |                                                                 |

- Milton 的数字取自 Milton (2010)「The development of vocabulary breadth across the CEFR levels」表 6 的两组法语学习者
  （西班牙、希腊），是累计的认识词量。CEFR 本身不规定词汇量。
- A1、A2 的累计（1,626、2,394）跟 FLELex（1,247、1,926）和 Milton 的估计对得上量级；B2 以上我们多得多，
  因为 FLELex 只统计教材里出现的词（1.4 万），XLex 只测最常用的 5,000 词，而 B2 以上要读真实文章，词典得把常用的 4 万词都分级。
- A2 比 A1 少：核心词表把一部分按词频本该是 A2 的生活词提到了 A1（FLELex 也是 A1 多、A2 少）。
- 跟 FLELex 的一致率（13,060 个两边都有级的词）：**同级 42.9%，差一级以内 84.2%**。混淆表（行 FLELex、列我们）：

  |     | A1  | A2  | B1  | B2   | C1   | C2  | 无  |
  | --- | --- | --- | --- | ---- | ---- | --- | --- |
  | A1  | 902 | 141 | 112 | 50   | 4    | 4   | 5   |
  | A2  | 175 | 110 | 174 | 166  | 31   | 7   | 1   |
  | B1  | 250 | 292 | 552 | 530  | 62   | 16  | 8   |
  | B2  | 45  | 129 | 680 | 2541 | 1063 | 404 | 60  |
  | C1  | 3   | 4   | 54  | 817  | 1006 | 797 | 191 |
  | C2  | 1   | 2   | 41  | 683  | 716  | 496 | 128 |

  A1 对得最好（902 / 1,218）；A2 本来就最难区分（FLELex 的 A2 词在我们这里散在 A1–B2）。

**来源** `sources`：CEFR（欧洲委员会）、Lexique、本软件的核心词表。

### 其他分级

- **词频段**（`freq`，wordlist）：Lexique 合成词频的名次 1–1,000、1,001–2,000、2,001–3,000、3,001–5,000、5,001–10,000、
  10,001–20,000，生词本可以按段背。对应 CEFR 大致 A1 / A2 / B1 / B1 / B2 / C1。
- 阶段三打算加：Français interactif 的教材词表（CC BY 3.0，按章，A1–A2）、主题词本。
  DELF / TCF 没有官方公开的词表（《法语参考水平》Beacco 等是有版权的书），不做「考试词表」。

## 四、词典数据（resources/data/fr/dict.sqlite）

10-10 的库：**105.0 MB，60,417 词条（82,746 个义项），查词键 591,006（严格 452,683、宽松 138,323），例句 57,614**。
词性：名词 35,083、形容词 11,503、动词 7,635、副词 2,777、词缀 632、感叹词 606、介词 562、短语 366、谚语 265、代词 249……

- **收词**：英文维基词典的法语词条为主，有词频或有中文的才收（冷僻词、只有字母的缩写不收）；虚词全收；专名只收常见的
  （Tatoeba 里出现 20 次以上，或核心词表里有的国名）。省音、倒装拼出来的组合（qu'il、n'est、a-t-il、puis-je）不单列——
  切词本来就拆开查；c'est 这种当整体学的留着。
- **义项**：英文释义 `en`（英文维基词典原文，**这个写法定了**）；中文 `zh`：人写的维基词典释义经 CC-CEDICT 的英文意思对到义项上
  （39,403 个义项，`zs: wikt-zh`），对不上的不硬塞；维基词典没有的用 CFDICT 反查（3,484 个，`zs: cfdict`）；虚词手写（295 个，`zs: fr-core`）。
  前 2,000 个词条 97% 有中文，前 8,000 个 90%，前 20,000 个 78%；其余等主线补译（`data/fr/zh-todo.txt` 列了前 8,000 个没有中文的常用词）。
  法语释义 `mono`（法语维基词典，55,985 个词条）。语体与地区标签 `t`、领域 `dom`、近义反义。
- **读音**：IPA（99%：英文维基词典 → 法语维基词典 → Lexique）；**变形的读音 `fi`**（42,979 个词条：法语维基词典的变位表读音，
  没有的用 Lexique 4.1 按「词形 + 原形」取，同形异音的不混）；录音 `au`（52,604 个词条，最多 4 个，地区各一）。
- **变形表 `f`**：动词全部单纯时态的变位（复合时态不列，`x.aux` 写助动词）、过去分词的阴性复数、名词与形容词的性数、异体与旧写法；
  标签用 Wiktextract 的标签词（简单过去时统一成 `past-historic`）。同一词形的几种可能（mange = 直陈式现在时一、三人称 / 虚拟式 / 命令式）
  各留一行查词键，阅读器放进 `alt`。
- **变形类别 `cls`**：动词的组（1er groupe 5,597、2e groupe 299、3e groupe 410）、代词式动词 pronominal。
- **特有字段 `x`**：`aux`（复合时态的助动词：avoir / être，6,171 个动词）、`h`（值 'aspiré'：词首 h 是嘘音 h，不省音、不连诵，424 个词条）。
- **分级 `lv`**：`cefr`（主分级）、`freq`（词频段）；`fr` 是合成词频的名次。
- **例句**：Tatoeba 47,409 句（20,277 句有中文、44,572 句有英文；`lv` 是句子里最难的词的等级），维基词典义项下 10,205 句。

## 五、后面各阶段的打算

### 阶段二：阅读与新闻

- `features.texts = true`、`grammar = true`、`ruby: 'ipa'`（每个词上方注 IPA，变形用 `fi`；可以关）。
- 语法点（`grammar.ts`）：照 CEFR 各级的语法清单（A1：être / avoir、冠词与性数、现在时、否定、疑问、近将来时……；
  A2：复合过去时与 être 动词、未完成过去时、代词 y / en、比较级……；B1：愈过去时、条件式、虚拟式现在时、关系代词 dont / où……；
  B2：先将来时、被动态、虚拟式的触发、分词句……；C1、C2：简单过去时、虚拟式未完成过去时、文学语体），每个点 2–4 句例句（自写或 Tatoeba），
  写 `patterns`：法语靠原形 + 变形标签认（复合过去时 = avoir / être 的现在时 + 过去分词，中间可以夹 ne / pas / 副词），拿例句验证。
- 课文：维基文库的拉封丹寓言（短，A2–B1）、佩罗童话（B1）、都德《磨坊书简》（B2）、莫泊桑短篇（B2–C1）、雨果、凡尔纳选段（C1–C2）；
  A1 没有合适的公有领域文本，自写几篇短对话、短文（写明「自写」）。难度用 `analyzeLex` 估。
- 新闻：上表能用的 14 个来源，RFI 简易法语标 `level: 'B1'`；全部 `license: 'headline'`。
- 拿真实新闻跑一遍，统计查不到词条的词的比例，补规则（数字与日期、专名、新词）。

### 阶段三：生词本

- 主题词本 25–30 本（家庭、身体、饮食、衣物、住房、城市、交通、学校、工作、医疗、天气、季节与节日、动物、植物、颜色、数字与计量、
  情感、性格、体育、音乐艺术、旅行、购物、电脑与网络、环境、政治与社会……），来源：核心词表、维基词典的主题分类（topics）、词频。
- 教材词表：Français interactif 各章的词汇（CC BY 3.0）。
- 易混词：同形不同性（le livre / la livre）、形近词（poisson / poison）、假朋友（librairie ≠ library）。

### 阶段四：课程

- **拼读课**（`alphabet: 'phonics'`）：字母与读音、变音符号、元音组合（ai ei au eau ou oi eu œu）、鼻化元音、不发音的词尾、
  连诵与省音、h muet / h aspiré，每课配录音的例词。
- **语法课**：阶段二的语法点按级成课。
- **变形课**：-er / -ir / 第三组常用动词的各时态，过去分词与配合，名词形容词的阴性复数；`wrong` 给常见错形（*il allera、*ils sontent、*j'ai allé）。
- **会话课**：问候、自我介绍、点餐、购物、问路、交通、打电话、看病、旅馆……（自写或 Tatoeba）。
- **故事课**：阶段二的课文从易到难排。

### 阶段五：练习与模拟卷

- 特有题型：冠词（定 / 不定 / 部分 / 否定句的 de / 缩合）、形容词配合、过去分词配合、avoir 还是 être、复合过去时与未完成过去时、
  宾语代词的位置（le / lui / y / en）、虚拟式的触发。
- 错拼法（`misspell`）：重音符号（é / è / ê）、双写辅音（appeler / appeller）、不发音的词尾（-ent / -e / -es）、同音异形（a / à、ou / où）。
- 模拟卷：DELF A1–B2、DALF C1–C2 每级一张，只做听、读和词汇语法（写、说不能自动判分），按答对比例换算 25 分制。

### 阶段六、七：视听与统计

主要是框架的事；法语补：字幕里的省音、连字符切词（规则已经有），字幕查词用 `fi` 给变形注音。

## 六、要框架做的（已写进阶段一汇报）

1. 界面叫法（`src/shared/lang/tags.ts`、`lib/i18n`）：
   - 变形类别 `1er groupe` / `2e groupe` / `3e groupe`（第一 / 二 / 三组动词）、`pronominal`（代词式动词）；
   - 特有字段 `aux`（复合时态的助动词）、`h`（h 嘘音：不省音、不连诵）；
   - 常见的标签：`invariable`（不变）、`familiar`（亲昵 / 口语）、`derogatory`、`pejorative`（贬义）、`euphemistic`（委婉）、`humorous`、
     `childish`（儿语）、`Anglicism`（英语借词）、`nonstandard`、`proscribed`（不规范）、`Quebec`、`Belgium`、`Switzerland`、`Africa`、
     `Louisiana`、`France`、`Internet`、`initialism`、`acronym`、`clipping`（截短词）、`before-vowel`（元音前）、`apocopic`（省音）；
   - 领域 `dom`：medicine、chemistry、mathematics、biology、law、music、sports、computing、politics、military、physics、botany、grammar、
     religion、cooking、finance……（`tags-check.ts` 列出全部与次数）。
2. README / 发布说明注明 CFDICT 的来源网站 https://chine.in（CFDICT 许可的要求）。
3. 补译：`scripts/lang/mt.ts split fr` 可以直接用；英文释义的写法已经定了。
