# 苏格兰盖尔语（gd，Gàidhlig）

> **进度（2026-10-10）**：阶段一（资料、特点与词典数据）完成。规则模块与测试、数据管线、词典库（过校验）、
> zh-todo、本文档都在分支 `lang/gd` 上。下一步是阶段二（阅读与新闻），见第七节。
> 要用户拍板的事列在第八节「待定」，现在都按最稳妥的默认做法做了。

## 一、这门语言的特点

苏格兰盖尔语是凯尔特语族盖尔语支的语言，跟爱尔兰语、马恩语是近亲。2022 年苏格兰人口普查约 7 万人会说
（另有约 4.6 万人听得懂），集中在外赫布里底群岛（Na h-Eileanan Siar）、斯凯岛和格拉斯哥等城市；
苏格兰有盖尔语授课的学校（FtMG），BBC ALBA、BBC Radio nan Gàidheal 用盖尔语播出。

### 文字与拼写

- **十八个字母**：a b c d e f g h i l m n o p r s t u。没有 j k q v w x y z（外来词照拼：telebhisean、bhidio）。
  h 几乎不单独作声母，主要用来标弱化（bh、ch、dh……）和加在元音前（na h-òrain）。
- **长元音用重音符**：à è ì ò ù（bàta「船」、mòr「大」）。《盖尔语正字法》（Gaelic Orthographic Conventions，GOC；
  1981 年由苏格兰考试局发布，SQA 2005、2009 年修订）只用重音符；之前的书刊还用锐音符 á é ó 区分闭口的长元音
  （mór、dé），旧文本里常见。
- **「宽对宽、窄对窄」**（caol ri caol is leathann ri leathann）：a o u 是宽元音，e i 是窄元音；一个辅音（串）
  两边的元音要同宽或同窄（balach → balaich 属格；Gàidhlig 的 ài…i），所以元音字母常常只是标出旁边辅音的
  「宽 / 窄」，本身不念：sgeul 的 e 只说明 sg 是窄的。
- 写法与读音差得远：一个音节常写四五个元音字母（ao、eòi、uai），不少辅音字母不发音（fh、有时的 th、dh、gh），
  还有写不出来的插入元音（下面「发音」）。

### 发音

- **清浊的对立其实是送气与否**：b d g 是不送气的清音 [p t k]，p t c 是送气音 [pʰ tʰ kʰ]——正好对上汉语拼音的
  b d g / p t k，这是中文母语者的优势。
- **送气前置**（preaspiration）：元音后的 p t c 前面带一个 h 音：cat [kʰaʰt]、bàta [ˈpaːʰt̪ə]、mac [maʰk]。
- **宽辅音、窄辅音**：宽辅音软腭化（像带 -w 的色彩），窄辅音腭化（像带 -y）；同一个字母宽窄读音可以很不一样：
  宽 ch [x]（loch）、窄 ch [ç]（oidhche）；宽 dh / gh [ɣ]、窄 dh / gh [j]；宽 s [s]、窄 s [ʃ]（sin [ʃin]）。
- **弱化后的读音**：bh、mh [v]（也常是 [w]）、ch [x] / [ç]、dh、gh [ɣ] / [j]、fh 不发音、ph [f]、sh、th [h]（th 有时不发音）。
  l n r 的弱化不写出来，但读音变。
- **插入元音**（svarabhakti）：某些辅音组合中间插进一个跟前面一样的元音：Alba [ˈal̪ˠapə]、gorm [ˈkɔɾɔm]、
  dearg [ˈtʲɛɾɛk]。
- 重音一般在第一个音节；长元音要读长（汉语普通话没有长短对立，要专门练）。
- 方言差别不小（刘易斯岛、南尤伊斯特、阿盖尔……）：维基词典的 IPA 常注出方言读法，词典里列在「方言读音」。

### 词首音变（最要紧的一点）

盖尔语的词会在**词首**变：查词典时，课文里的 bhàta 要还原成 bàta 才查得到。日语是词尾变化（食べた → 食べる），
盖尔语难在词头。

- **弱化**（lenition，sèimheachadh）：b c d f g m p s t 后面加 h——b→bh、c→ch、d→dh、f→fh（不发音）、g→gh、
  m→mh、p→ph、s→sh、t→th。sg sm sp st 开头的不弱化；l n r 弱化不写出来；元音开头的不弱化。
  常见的触发：
  - 物主代词 mo「我的」、do「你的」、a「他的」：mo bhàta、do bhàta、a bhàta（a「她的」不弱化：a bàta，元音前加 h-：a h-athair）；
  - 冠词：阴性名词主格（a' bhean、a' chaileag）、阳性名词属格（cù a' bhalaich「男孩的狗」）、介词 + 冠词后（air a' bhàta）；
  - 阴性名词后的形容词（caileag bheag「小女孩」）；
  - 动词过去式（bhuail、chuir；元音和 fh 开头的前面加 dh'：dh'òl、dh'fhalbh）、条件式；
  - 介词 de、do、fo、mu、bho / o、ro、tro、gun「没有」（do Ghlaschu「去格拉斯哥」）；
  - 数词 aon（d t s 除外）、dà（aon chat、dà chat）；
  - glè「很」、ro「太」、fìor「真」、deagh「好的」、droch「坏的」（glè mhath、ro mhòr、droch shìde）；
  - 呼格（a Mhàiri；阳性名词还要窄化：a Sheumais ← Seumas）。
- **词首加字母**（有连字符）：t-（an t-uisge「水」；an t-sràid「街」）、h-（na h-òrain「那些歌」、a h-uile「每个」）、
  n-（ar n-athair「我们的父亲」）。
- **窄化**（slenderisation）：属格、呼格、复数常把最后一个宽元音变窄：balach → balaich、cat → cait、fear → fir。

### 形态

- 名词分阳性、阴性（m / f），性决定冠词形式、弱化和形容词的变化，要跟词一起记。
- 格：主格、属格、与格（介词后；现代口语里多同主格）、呼格。属格表示所属、名词修饰名词（taigh an duine「那人的房子」，
  前一个名词不带冠词）。
- 复数：-an、-ean、-tean、-ichean、内部窄化（cait）等，不规则的多。
- **冠词**有一串形式：an、am（b f m p 前）、an t-（元音前、s 前）、a'（弱化前）、na、na h-（元音前）、nan、nam（b f m p 前）。
  没有不定冠词：cat「一只猫」、an cat「那只猫」。
- 动词：词根就是命令式（òl「喝！」），过去式靠弱化（dh'òl），将来时 -idh / -aidh（òlaidh），条件式 -adh / -inn，
  另有无人称（被动）形式。不规则动词只有十个左右（bi、is、rach、thig、dèan、faic、faigh、thoir、cluinn、can / abair、
  ruig），但都很常用。
- **独立式与从属式**：同一个时态有两套形式，肯定句用独立式，否定、疑问、从句用从属式：chunnaic mi「我看见了」/
  chan fhaca mi「我没看见」/ am faca tu?「你看见了吗？」；bha / robh、tha / eil、thèid / tèid。
- **动名词**（verbal noun）代替分词与不定式：tha mi a' dol「我正在去」（ag + 动名词；辅音前 ag 写成 a'），
  tha mi ag ionnsachadh Gàidhlig「我在学盖尔语」；宾语是代词时放到前面当物主：ga dhèanamh「在做它」。
- **介词代词**：介词跟人称代词合成一个词：aig + mi = agam、air + mi = orm、le + e = leis……每个常用介词七八种形式，
  还有强调形（agamsa）。
- 强调代词：mise、thusa、esan、ise、sinne、sibhse、iadsan。
- 形容词比较：nas motha「更大」、as motha「最大」、nas fheàrr「更好」（math 的比较级不规则）。

### 句法

- **动词在句首**（VSO）：Chunnaic mi an cat「看见 我 那猫」。
- **两个「是」**：bi（tha、bha、bidh……）说状态、地点、进行（Tha mi sgìth、Tha i anns a' bhùth、Tha mi a' dol），
  系词 is 说身份、归类、喜好（Is e tidsear a th' annam「我是老师」，Is toigh leam ceòl「我喜欢音乐」）。
  学的人最常混的就是这两个。
- **没有「有」这个动词**：Tha cù agam「一只狗在我这儿」= 我有一只狗；感觉、病痛「在身上」：Tha an t-acras orm「我饿」。
- **没有「是 / 不是」这两个词**：用动词回答：A bheil thu sgìth? — Tha. / Chan eil.
- 间接引语、宾语从句用从属式与 gu bheil / nach eil（Tha mi a' smaoineachadh gu bheil e ceart「我想他是对的」）。

### 学习者——尤其是中文母语者——的难点

1. **查不到词**：词头会变（弱化、加 t- / h- / n-、省音的 dh'），课文里的词形常常不是词典的词头。这是做这门语言
   最先要解决的事：词典与阅读器要能从 bhàta、t-uisge、dh'fhalbh、chunnaic、agam 找回原形（见第二、四节）。
2. **读音靠不住拼写**：元音字母多、不发音的辅音多，宽窄辅音汉语里没有对应（倒是普通话的 j q x 与 g k h 的分别
   可以帮着理解窄 / 宽的 c g）。要先学一套拼读规则，再配 IPA 和录音反复听；Windows、macOS 都没有盖尔语语音。
3. **词序与两个「是」**：VSO、bi 与 is 的分工、「有」要说成「在我这儿」，跟汉语的思路差得远。
4. **性与格**：汉语没有名词的性和格，盖尔语的冠词、弱化、形容词都跟着性和格变。
5. **长元音**：重音符标的长元音要读长，普通话没有长短对立。
6. **资料少**：小语种，开放的中文资料几乎没有，英语是主要的中介语言。
   优势：送气 / 不送气的分别跟普通话一样；动词时态比欧洲大语种简单。

### 跟日语的做法哪里不一样

| 方面 | 日语 | 盖尔语 |
|---|---|---|
| 查词还原 | 去词尾（活用、助动词），kuromoji 分词 | **去词首音变**：去弱化的 h、去 t- / h- / n-、省音的 dh' m' b'，再加词尾与窄化；词形表里收维基词典的全部变形 |
| 切词 | 分词器 | 自己写：撇号与连字符留在词里（a'、dh'fhalbh、t-uisge），引号不算 |
| 注音 | 振假名 / 罗马字 | **IPA**（features.ruby = 'ipa'），不需要罗马化 |
| 朗读 | Windows 日语语音 | **没有系统语音**：维基共享资源 / Lingua Libre 的真人录音（还很少）、IPA、用户自己录音 |
| 字母课 | 五十音（逐个字） | **拼读规则课**（phonics）：宽窄、弱化、送气前置、长元音、插入元音 |
| 分级 | JLPT 有官方等级与通行的分级词表 | 通行的是 CEFR（CLAG、SpeakGaelic 都按 CEFR），**没有官方词表**：A1 手挑 + 语料词频切分 |
| 中文释义 | JMdict 英文释义翻译 + Tomoshi | **没有盖中词典**：中文维基词典（几百条）+ 词网对照（自动配对，标出来）+ 以后统一机器翻译 |
| 例句 | Tatoeba 日中对照两万多句 | Tatoeba 盖尔语只有一千来句、质量参差，要挑贡献者；维基词典例句 |

## 二、规则模块（src/shared/lang/gd/）

- `rules.ts`
  - `key`：tidy、小写、锐音符 → 重音符（mór → mòr）、各种撇号与连字符统一。
  - `looseKey`：再去掉重音符、撇号、连字符、空格（Gaidhlig → gaidhlig，an diugh / an-diugh）。
  - `tokenize`：撇号、连字符留在词里；词尾撇号只跟在省音形后（a' dh' m' d' b' th' bh' ars'），词首撇号只在已知的
    省音形（'s 'n 'na 'ga 'sa 'nuair……）；序数与年代（21mh、1990an）算数字。
  - `lemmaCandidates`：整词省音形（a' → an / ag、'S → is / agus）→ 去 t- h- n-（标签 t-prothesis、h-prothesis、eclipsis）
    → 去省音（dh'fhalbh → fhalbh）→ 去带连字符的强调后缀（chàr-sa）→ 带前缀的复合词（ro-mhath）→ 去弱化 →
    去动词词尾（-aidh、-adh、-inn、-amaid、-ibh、-te……）与名词词尾（-ichean、-ean、-an……）→ 去窄化（balaich → balach）。
    form 表查不到时才用（form 表里已经有维基词典的全部变形）。
- `mutation.ts`：弱化 `lenite` / 去弱化 `delenite`、`canLenite`（sg sm sp st、l n r、元音、已弱化的、带前缀的都不弱化）、
  去前缀、去省音、去强调后缀、去窄化的几种猜法、宽窄拼写规则检查（以后的拼读课与练习用）。
- `spec.ts`：叫法、分级（CEFR 主分级 + SQA 说明）、能力（阶段一只开 lexicon；ruby 'ipa'；speech null）。
- 测试 `tests/lang/gd/`：规则、词首音变、学习包描述，以及**用主进程的读库代码查生成的词典库**（dict.test.ts：弱化形、
  不规则动词、介词代词、前缀、窄化、旧拼写、多词说法、中英文反查；没生成库时跳过）。共 45 项。

## 三、资料清单

「这台电脑」一栏是 2026-10-09 在本机实际请求的结果。

### 词典数据用上的

| 资料 | 许可 | 地址 | 取了什么 | 再分发 | 这台电脑 |
|---|---|---|---|---|---|
| 英文维基词典的盖尔语词条（kaikki.org / wiktextract，enwiktionary 2026-09-02 dump） | CC BY-SA 4.0 | https://kaikki.org/dictionary/Scottish%20Gaelic/ | 18,204 页：词条、英文释义、IPA（含方言）、变格变位与弱化表、例句 1,543 句、词源、录音地址 | 可（署名、相同方式共享） | 能下，29.3 MB 约 4 分钟 |
| 中文维基词典「苏格兰盖尔语」（kaikki.org，zhwiktionary 2026-10-01） | CC BY-SA 4.0 | https://kaikki.org/zhwiktionary/ | 364 页里 264 个词条的中文释义（繁体 → 简体） | 可 | 能下，0.5 MB |
| Unified Scottish Gaelic Wordnet v0.9（USGW） | CC BY-SA 3.0 | http://ukc.disi.unitn.it/index.php/gaelic/ | 10,139 个盖尔语词的同义词集（WordNet 2.1 编号）、8,936 条盖尔语释义；维基词典没收的 5,205 个词另成词条 | 可 | 能下（http），0.3 MB |
| 由维基词典导出的盖尔语词网（OMW wn-wikt-gla） | CC BY-SA | https://github.com/omwn/omw-data/tree/main/wns/wikt | 6,670 个「词—同义词集（3.0）」 | 可 | 能下 |
| Chinese Open Wordnet（OMW 数据） | WordNet 式许可（可再分发，保留版权声明） | https://github.com/omwn/omw-data/tree/main/wns/cow | 同义词集的中文词 → 词网对照的中文释义 | 可 | 能下，2.5 MB |
| Princeton WordNet 3.0（OMW 数据）与 2.1→3.0 义项对照（WNsnsmap-3.0） | WordNet 3.0 许可 | https://wordnetcode.princeton.edu/3.0/ | 同义词集的英文词、英文词的义项序号；把 USGW 的 2.1 编号换成 3.0 | 可 | 能下 |
| UD Scottish Gaelic ARCOSG（UD 仓库 master，2026-10） | CC BY-SA 4.0 | https://github.com/UniversalDependencies/UD_Scottish_Gaelic-ARCOSG | 8.6 万词、人工标的原形：词频（权重 0.45）、几个词条同形时分配次数 | 可（只用了统计） | 能下，5.9 MB |
| GaelicFrequencyLists（LearnGaelic《Litir do Luchd-ionnsachaidh》与 Watch Gaelic 字幕统计） | MIT | https://github.com/innesmck/GaelicFrequencyLists | 前一万个词形的次数（共 131 万词）：词频（权重 0.35）。原文版权属 BBC / LearnGaelic，**只用统计数字** | 可（统计） | 能下 |
| 盖尔语维基百科 Uicipeid（2026-10-01 dump） | CC BY-SA 4.0 | https://dumps.wikimedia.org/gdwiki/ | 条目正文（去掉模板、表格、小标题、列表）146 万词：词频（权重 0.20） | 可 | 能下，10 MB，**要断点续传**（中途断过） |
| Tatoeba（盖尔语句子、盖英链接、英文句子、英中链接、中文句子） | CC BY 2.0 FR | https://downloads.tatoeba.org/exports/per_language/ | 1,052 句里收 642 句（见第四节「例句」）；英文翻译直接对应，161 句有经英文转接的中文翻译 | 可（署名） | 能下（英文句子 25 MB） |
| 维基共享资源：Lingua Libre（Category:Lingua Libre pronunciation-gla，12 条）、维基词典挂的录音 | 多为 CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/Category:Lingua_Libre_pronunciation-gla | 23 条录音挂在 18 个词条上（mp3 转码地址，联网播放） | 可（署名） | 能连 API |
| OpenCC 繁简对照表 | Apache 2.0 | https://github.com/BYVoid/OpenCC | TSPhrases、TSCharacters：中文维基词典的繁体释义转简体 | 可 | 能下 |
| 自写：A1 基础词表（data/gd/core-a1.txt，472 个、14 个主题）、补充词条（data/gd/supplement.tsv，20 条 + 3 处拼法） | CC0 | 本仓库 | A1 分级、主题词本；维基词典与词网都没收的常用词 | 可 | — |

### 分级的依据（参考，不入库）

- CLAG（Comasan Labhairt ann an Gàidhlig）盖尔语口语能力等级描述：阿伯丁大学做的，LearnGaelic 采用；
  https://learngaelic.scot/clag/learners/ （自评表与各级清单）。
- SpeakGaelic 课程的四级与学时：https://speakgaelic.scot/ 。
- SQA 现代语言课程说明（Gaelic (Learners) 与法语、德语等同一份）：
  N5 https://www.sqa.org.uk/files_ccc/n5-course-spec-modern-languages.pdf 、
  Higher https://www.sqa.org.uk/files_ccc/h-course-spec-modern-languages.pdf 、
  AH https://www.sqa.org.uk/files_ccc/AHCourseSpecModernLanguages.pdf 。
- LearnGaelic 按级的资源页（https://learngaelic.scot/a1.jsp 到 c2.jsp）：哪套课程适合哪一级。

### 后面阶段用的（调研过）

| 资料 | 许可 | 地址 | 打算 | 这台电脑 |
|---|---|---|---|---|
| **BBC Naidheachdan RSS**（BBC 盖尔语新闻） | BBC 版权；使用条款第 15 条：个人可以把 BBC 新闻 RSS 原样放在自己的网站或账号上，不改动、注明 BBC 并放链接；商业用途要许可 | https://feeds.bbci.co.uk/naidheachdan/rss.xml | 阶段二：只收标题与导语（description），带原文链接，照 NHK 的做法 | 能取，19 条，盖尔语标题 + 一两句导语 |
| Litir do Luchd-ionnsachaidh 播客（BBC Radio nan Gàidheal，每周一封「给学习者的信」） | BBC 版权 | https://podcasts.files.bbci.co.uk/b007jdd3.rss | 阶段二 / 六：列标题与链接，音频联网播放；文字稿在 LearnGaelic 网站（版权），只放链接 | 能取，995 集 |
| Bòrd na Gàidhlig 新闻 | 版权（盖尔语委员会） | https://www.gaidhlig.scot/gd/feed/ | 阶段二：标题与导语 | 能取，10 条 |
| Tog Blog（盖尔语博客汇集） | 各博客自有版权 | https://togblog.org/feed/ | 阶段二备选：标题与导语 | 能取 |
| 盖尔语维基百科条目 | CC BY-SA 4.0 | https://gd.wikipedia.org/ | 阶段二：挑短而好读的条目做阅读材料（全文可收） | dump 已下 |
| 维基文库「Gàidhlig」分类（约 59 页，多为诗） | 公有领域 | https://wikisource.org/wiki/Category:Gàidhlig | 阶段二：诗与短文 | 能连 API |
| 古登堡计划的盖尔语书（4 本：Coinneach Odhar, Am Fiosaiche；Gearr-sgeoil air Sir Seoras Uilleam Ros；Caoidh airson cor na Gaidhealtachd…；The Princess' welcome to the Highlands） | 公有领域 | https://www.gutenberg.org/ebooks/28995 等 | 阶段二：故事、诗（旧拼写，要标明） | 能下目录 |
| J. F. Campbell《Popular Tales of the West Highlands》（1890–93 版，含盖尔语原文） | 公有领域 | 英文维基文库 Index:Popular Tales of the West Highlands, Volume I–IV | 阶段四「故事」课：挑短的民间故事；要核对转录进度与旧拼写 | 能连 |
| Nicolson《A Collection of Gaelic Proverbs and Familiar Phrases》（1881） | 公有领域 | archive.org 扫描本 | 阶段四惯用语课：谚语（要人工核对 OCR、换成现代拼写时注明） | 待取 |
| MacBain《An Etymological Dictionary of the Gaelic Language》（1896 / 1911） | 公有领域 | 英文维基文库全文 | 以后补词源 | 能连 |
| 盖尔语圣经（1807 / 1902 版） | 公有领域 | 待找可用的数字文本（1992 修订版有版权） | 备选的大段文本 | 未取 |
| SQA Gaelic (Learners) 历年试卷与样卷 | SQA 版权 | https://www.sqa.org.uk/sqa/47415.html | 阶段五：只参考题型与结构，不照搬题目 | 能连 |

### 放弃的、只做外部链接的

- **Am Faclair Beag**（https://www.faclair.com/ ，Michael Bauer、Will Robertson，含 Dwelly 全文与录音）、
  **LearnGaelic 词典**：有版权，不能取数据；在软件里作为「推荐学习者使用的外部资源」列出。
- **Dwelly 的数字版（Dwelly-d）**：Dwelly 1911 年的原书是公有领域，但 Michael Bauer 整理校对的数字版不是开放许可
  （网上说法是 CC BY-NC，没找到可下载的数据）；archive.org 的 OCR 文字（Dwelly_djvu.txt，5.9 MB）错漏太多，
  阶段一不用。以后要补旧词时再考虑人工校对一小部分。
- **An Crúbadán**（Kevin Scannell 的网络语料词频，CC BY 4.0）：crubadan.org 从这台电脑连不上，没用。
- Corpas na Gàidhlig / DASG（格拉斯哥大学的盖尔语语料库）：只能在线检索，没有开放下载。
- Tobar an Dualchais（口述档案）、SpeakGaelic、Duolingo 课程：版权，只做外部链接。
- Leipzig、OSCAR、CC-100 的盖尔语语料：许可不清楚或体积大，不用。
- 网上找得到的 dana-mag.org、gaelcast.com 的 RSS：从这台电脑连不上（可能已经停了）。

## 四、词典数据（resources/data/gd/dict.sqlite）

生成：`node scripts/data/run-ts.mjs scripts/data/gd/build.ts`（下载放 .cache/data/gd/，已有的跳过；生成十秒左右）。
校验：`node scripts/data/run-ts.mjs scripts/lang/validate.ts gd`（合格）。

### 管线步骤

1. **维基词典词条**（scripts/data/gd/kaikki.ts）：
   - 词性对到 UPOS（连词按词分并列 / 从属；冠词算 det；字母算 symbol）；名词的性取义项标签。
   - 变形表去掉模板残留：表头说明、模板名、「tha e / i」拆开留下的单个代词、^(N 1)) 脚注、after "an" 这类说明；
     短语形（an cat、chan eil mi、nas fheàrr、(a') chait）拆出那个词；标签换成界面的标签词（prothesis-t → t-prothesis、
     noun-from-verb → verbal-noun）。
   - **「某词的某形式」页不单独成条**：chunnaic（faic 的过去式）、bhàta（bàta 的弱化形）、coin（cù 的复数）、dé（dè 的旧写法）、
     agam（aig 的介词代词）这类页面（9,027 页）并进原形的变形表，阅读器、查词靠变形表找回原形；只用文字写着
     「vocative/genitive singular of salann」「Sutherland form of thoir」的一百来页也认出来并进去；
     找不到原形的 52 页单独成条。这一页的 IPA、录音挂到原形上（x.formIpa、录音的 label 写词形）。
   - 动名词只有「某动词的动名词」一个意思的（dol → rach）并进动词；另有意思的（dèanamh「做法」）照样成条，x.vnOf 记动词。
   - 弱化形：变形表里有的照收，没有的按规则补（名词、形容词、动词、专名、数词），x.len 记词头的弱化形。
     词首音变的几行排在变形表前头（阅读器一个词形对上几行时取第一行的标签，bhàta 先报「弱化」）；动词不排（动词的弱化形就是过去式）。
2. **中文与盖尔语释义**（zh.ts、wordnet.ts）：见下「中文释义」。
3. **词网另成的词条**：USGW 里维基词典没收的 5,205 个词（tachartas「事件」、dleastanas「职责」……），英文释义是
   同义词集的英文词，中文来自中文开放词网，盖尔语释义来自 USGW；没有性的信息。
4. **补充词条**（data/gd/supplement.tsv）：维基词典与词网都没收、语料里又常见的 20 个词（mus「在……之前」、buidheann
   「团体」、iomadach「许多」、sna「在那些……里」、neach-poileataigs「政治家」……），另给已有词条补 3 处语料里常见的拼法。
5. **多词说法的分段**：sam bith、mu dheidhinn、's dòcha、Dùn Èideann 里自己不成词的那一段（sam、dheidhinn、dòcha、Èideann）
   挂成整个说法的词形，阅读器一个词一个词地查也能找回整个说法（125 处）。
6. **词频**（freq.ts）、**分级**（levels.ts）：见第五节。
7. **例句**：维基词典例句挂在义项上；Tatoeba 例句按词挂到词条。
8. 写库；`data/gd/zh-todo.txt`。

### 数字（2026-10-10 生成）

| 项目 | 数 |
|---|---|
| 词条 | 15,401（维基词典 10,176、词网 5,205、补充 20） |
| 查词键 | 87,376（严格键 + 宽松键） |
| 有变形表的词条 | 12,120 |
| 有 IPA | 3,776；方言读音 1,210 个词条；词形读音（x.formIpa）858 个词条 |
| 录音 | 18 个词条、23 条 |
| 有中文释义 | 3,778 个词条（中文维基词典 264，词网对照 3,516） |
| 有盖尔语释义（mono） | 5,853 |
| 有词频 | 5,740 |
| 例句 | 2,185（维基词典 1,543；Tatoeba 642，其中 161 句有中文） |
| 库大小 | 12.2 MB |

各级有中文释义的比例：A1 45%、A2 40%、B1 33%、B2 30%、C1 25%、C2 22%。

### 词条的 x（盖尔语特有）

| 键 | 内容 | 例 |
|---|---|---|
| `len` | 词头的弱化形 | bàta → bhàta |
| `vn` | 动词的动名词 | rach → dol |
| `vnOf` | 这个动名词是哪个动词的 | dèanamh → dèan |
| `ety` | 词源（维基词典，英文，最多 400 字） | From Middle Irish bát … |
| `ipaDialects` | 方言读音（文字列表：「IPA（地区）」） | /mɛ̃(h)/（Wester Ross, most of South Argyll） |
| `formIpa` | 变形的读音（文字列表：「词形 IPA」，阅读器给变过的词注音用，按第一个空格拆开） | chù /ˈxuː/ |

变形表的标签沿用维基词典的标签词；盖尔语多出的：lenition（弱化）、h-prothesis、t-prothesis、eclipsis（n- 前缀）、
dependent / independent（从属式 / 独立式）、verbal-noun、emphatic（强调形，agamsa）、impersonal（无人称）。

### 中文释义

盖尔语没有开放的盖中词典。现在分三层：

1. **中文维基词典**（zhwikt，人写的）：264 个词条。繁体转简体（OpenCC）；词头要一字不差（mór 的「mòr 的旧写法」不挂到 mòr 上）；
   「X 的旧写法」这类指向别的词的说明不当释义；写错了的（冠词 an「用于名词后」）去掉。
2. **词网对照**（wn-zh，自动配对，界面上注明来源）：盖尔语词所在的 WordNet 同义词集 × 中文开放词网同一个同义词集的中文词。
   为了少出错：同义词集的英文词要跟这个义项的英文释义对得上；对上的条数多的、英文词的义项序号靠前的优先；
   释义带括号限定（mouse (input device)）又只对上一条的不用；同义词集里的中文词按 Tatoeba 中文句子里的出现次数排。
   抽查 60 条，八成五以上对，错的多是英文多义词挑错了义项（rach「go」配成「离开」）。
3. 其余的：`data/gd/zh-todo.txt` 按词频列出有词频、还没有中文的 4,021 个词条（一行一个：词头、词性、英文释义，
   义项之间用 | 隔开），等主线统一机器翻译（标 mt-）。词网对照的那些如果要复核，可以按 zs = 'wn-zh' 从库里取。

### 例句

- 维基词典例句 1,543 句（有英文翻译、文学引文太长的不要），挂在义项上。
- Tatoeba：一共 1,052 句。早期有学习者贡献的句子错得不少（ballach、Choinneach an neach-ionnsachaidh、Tòisich 当过去式），
  所以只收抽查下来地道的六位贡献者（括号里是各自一共贡献的句数：Catriona 400、Cainntear 227、User66640 63、megamanenm 50、canan 13、emigonza 13），
  句子里每个词都要查得到（错字会查不到），要有英文翻译：收 642 句。中文翻译经英文转接（盖尔语 → 英文 → 中文，都是人工翻译），
  161 句有，标 tatoeba-via-en。
- 每句例句按句中词条的最高等级估了难度（A1 359、A2 668、B1 453、B2 360、C1 252、C2 81）。

## 五、分级

### 主分级：CEFR A1–C2

盖尔语学习界通行的就是 CEFR：LearnGaelic 按 CLAG（阿伯丁大学的盖尔语口语能力等级描述）分 Pre-A1、A1–C2，
SpeakGaelic 的四级对应 A1–B2。各级说明（spec.ts）参照 CLAG 自评表与清单概括（不是原文），写了每一级要会的盖尔语说法：

| 等级 | 能做什么（概括） | 对应 |
|---|---|---|
| A1 | 问候道谢（madainn mhath、tapadh leat）、介绍自己和家人、说有什么（tha cù agam）、进行体（tha mi a' dol）、数字与时间，一次三四个词 | SpeakGaelic 入门（Inntrigeadh，13 课、约 90–100 学时）；Speaking our Language 第 1–18 集 |
| A2 | 讲家人、工作、爱好，讲过去（bha、chaidh），比较（nas fheàrr），系词说身份与喜好（Is e … a th' annam、Is toigh leam），邀请、道歉、约时间 | SpeakGaelic 基础（Bunaiteach，约 90–100 学时）；Speaking our Language 第 19–36 集；大致 SQA National 5 |
| B1 | 不经准备地谈熟悉的话题，讲经历、打算和理由，用 gu bheil / nuair a 连成长句，将来时与条件式 | SpeakGaelic 中级（Eadar-mheadhanach，约 150–200 学时）；Speaking our Language 第 37–54 集、Litir Bheag；大致 SQA Higher |
| B2 | 较广话题的详细讨论、利弊、假设（ged a、mura），轮到自己时连说两三句，看得懂 BBC 盖尔语新闻大意 | SpeakGaelic 高级（Adhartach，约 150–200 学时）；Watch Gaelic、An Là；大致 SQA Advanced Higher |
| C1 | 复杂抽象话题，口语与正式文体切换，长句（属格链、被动、关系从句），能主导对话；读评论、现代小说与诗 | Litir do Luchd-ionnsachaidh、BBC 盖尔语节目 |
| C2 | 几乎什么都懂，包括方言、老派文体、谚语；是很成功的学习者的水平，不等于母语者 | — |

### 其他分级（只作说明，不挂词）

- **SQA 盖尔语（学习者）**（spec.ts 的第二套）：苏格兰中学的考试，National 3 / 4（校内评定、没有统一考试）、National 5、
  Higher、Advanced Higher，SCQF 第 3–7 级。各级的考试结构写在等级说明里（N5：阅读 30、写作 20、听力 20、写作作业 20、
  口语 30；Higher：阅读 30（含 10 分英译）、定向写作 20、听力 20、写作作业 20、口语 30；AH：阅读与翻译 50、
  听力与议论文 70、作品集 30、口语 50）。跟 CEFR 的对应是我们的估计（N3 / N4 ≈ A1、N5 ≈ A2、Higher ≈ B1、AH ≈ B2）：
  SQA 没有公布现代语言课程的 CEFR 对照，只有 ESOL 有（N5 ESOL = B1、Higher ESOL = B2），学外语的同级考试要求低一些。
- **Ùlpan**（成人沉浸课程，144 个单元）：1–48 单元为初级、49–96 中级、97–144 高级，大致对 A1–A2、B1、B1+–B2；
  没有公开的词表，只在文档里说明。
- SQA 不发词表，Ùlpan、SpeakGaelic 的词表不公开，所以这两套都不挂词。

### 词怎么分到各级

1. **A1**：手挑的基础词表 `data/gd/core-a1.txt`（472 个词与短语，14 个主题：问候、人与家庭、代词与疑问、小词、数字、时间、
   吃喝、家与地方、交通、天气与自然、描述与颜色、身体、语言学习与工作、常用动词），依据是 CLAG A1 清单要会说的事
   与入门课普遍先教的主题；同形的几个词条只取最常用的（daor「贵」进 A1，daor「奴隶」不进）；
   再加限定词、介词、代词、小品词、连词里词频前 150 的。
2. **词频**：三份语料各数一遍，换成每百万词的次数，按权重相加：ARCOSG（人工标原形，平衡语料：对话、体育解说、口述故事、
   新闻、访谈、小说、正式散文、报纸专栏）0.45、LearnGaelic 词频表（给学习者的真实材料）0.35、维基百科（量大但偏百科）0.20。
   后两份只有词形，按词典的变形表找原形（跟阅读器查词同一套键），一个词形对上几个词条时按 ARCOSG 里各词条的次数分。
   ARCOSG 里对不上词条的 4,745 词次多是人名地名（[Name]、Yugoslavia、MacLeish……）。
3. **A2–C2**：其余词条按合并词频排，累计切：A2 到 1,300 词、B1 到 2,500、B2 到 3,800、C1 到 4,800，再往后是 C2
   （语料里出现过、但最不常见的词）。专名、词缀、字母、短语、谚语不按词频分级（核心词表里的除外）；
   只有古旧、已废义项的词最低放到 C1。**语料里没出现过的词不分级**（约一万个，多是生僻词、术语、复合词）。
4. 切分的依据：常见的 CEFR 词汇量估计（A1 约 500–600、A2 约 1,200–1,500、B1 约 2,500、B2 约 4,000）；
   盖尔语没有官方数字可对。语料小（三份合计约 290 万词），出现过的词条只有五千多个，所以 B2 以上切得紧。

**各级词数（括号里是累计）**：A1 486（486）、A2 811（1,297）、B1 1,196（2,493）、B2 1,290（3,783）、
C1 1,017（4,800）、C2 525（5,325）。主题词本 14 本（theme:greetings 等，共 472 词）。

抽看各级的词：A2 有 casaid「指控」、cùrsa「课程」、iasgair「渔夫」；B1 有 làitheil「每天的」、giotàr、gràmar；
B2 有 foighidinn「耐心」、reachdas「立法」；C1 有 faclaireachd「词典学」、leth-bhreith「歧视」——大体合理。

## 六、阶段一的检查

- `npx vitest run tests/lang/gd`：45 项全过（规则、学习包描述、用主进程读库代码查词典库）。
- `node scripts/data/run-ts.mjs scripts/lang/validate.ts gd`：合格。
- `npm run typecheck`：0 错误；`npm run lint`：没有问题。
- 隔离实例（`--user-data-dir` 临时目录、调试端口 9417）里看过词典：bhàta → bàta（「bhàta」是「bàta」的弱化）、
  chunnaic → faic（过去时）、dh'fhalbh → falbh、agam / aige → aig（第一人称单数 / 第三人称阳性单数）、t-uisge → uisge（加 t-）、
  Ghàidhlig → Gàidhlig、salainn → salann（属格单数）、sheall → seall（过去时）、mór → mòr、dog / 狗 → cù。
  **主线的词典界面第一次打开会报错**（见第九节），看的时候在本地临时改了一行，没有提交。

## 七、后面各阶段的打算

- **阶段二（阅读与新闻）**：
  - 新闻：BBC Naidheachdan RSS（标题与导语、原文链接）、Bòrd na Gàidhlig；阅读材料：维基百科短条目、维基文库的诗、
    古登堡的几本、Campbell 民间故事（旧拼写的要标出来）。
  - 阅读器：IPA 注音按词形取（x.formIpa；没有的不拿原形的 IPA 顶替）；**多词说法**（a h-uile、sam bith、mu dheidhinn、
    's dòcha、旧写法的 an diugh）要连起来认；正文上标出弱化、前缀（可开关的记号），让学的人看见词首的变化。
  - 语法点：A1–B2 的常用结构（tha … aig、Is toigh leam、ag + 动名词、gu bheil / nach eil、bu chòir、feumaidh、
    is urrainn dhomh、a' dol a、air + 动名词（完成）、nas … na、ged a、mura……），按 CLAG 清单与 SQA 的语法表分级，
    例句自己写、能对语料的对语料。
- **阶段三（生词本）**：CEFR 各级词表、14 个主题词本（再扩到 A2–B1）、SQA 话题（社会、学习、就业、文化）词本。
- **阶段四（课程）**：**拼读规则课**（宽窄、弱化的读音、送气前置、长元音、插入元音，每条规则配录音与例词）；
  语法课（上面的语法点）；变形课（冠词形式表、弱化、属格、介词代词、不规则动词的独立式与从属式）；
  会话课（问候、自我介绍、购物、天气）；惯用语（Nicolson 谚语里挑常用的）；故事（Campbell 民间故事）。
- **阶段五（练习与模拟卷）**：题型按盖尔语的特点：选对的弱化形 / 冠词形式、独立式与从属式、bi 还是 is、介词代词、
  动名词结构；模拟卷照 SQA National 5 / Higher 的卷面（阅读英问英答、写作回应要点、听力），题目全由数据生成。
- **阶段六、七**：视听字幕查词沿用通用的；统计无特别。
- **阶段八**：补中文（主线机器翻译 zh-todo 之后复核常用词）、补录音（Lingua Libre 录音很少，可以请用户自己录）、
  补 Dwelly 里的常用旧词。

## 八、待定（要用户拍板的，现在的默认做法）

1. **词网对照出的中文释义（wn-zh）**：自动配对，抽查约八成五对。默认：保留并在界面注明来源；
   要是嫌错的多，可以只留中文维基词典的，其余全交机器翻译。
2. **Tatoeba 经英文转接的中文翻译**：默认保留（标 tatoeba-via-en）。
3. **词网另成的 5,205 个词条**：多是专业译者新译的，但没有性、变形；默认保留。
4. **C2 只收语料里出现过的最不常见的词**，没出现过的约一万个词条不分级。默认如此。
5. **专名不分级**（核心词表里的 Alba、Gàidhlig、Glaschu 等除外）。
6. **手写的补充词条 20 条、A1 词表 472 个**：默认收。补充词条的释义、性、复数请懂盖尔语的人看一眼（data/gd/supplement.tsv）。
7. **SQA 跟 CEFR 的对应**是估计的（N5 ≈ A2、Higher ≈ B1、AH ≈ B2），SQA 没有官方说法。

## 九、要框架做的

- **词典界面的错误**：`src/renderer/src/lib/dict/LexDictionary.svelte` 第 23 行 `const memo = $derived(dictState.of(code))`
  （`LexGrammarDict.svelte` 第 16 行同样）——`dictState.of()` 第一次会新建状态，在 `$derived` 里改状态 Svelte 报
  state_unsafe_mutation，新用户第一次打开任何框架语言的词典都会整页报错（QonDictionary.svelte 的注释说的就是这件事）。
  本地验证时在那一行前面先调一次 `dictState.of(code)` 就好了；请主线修。
- **标签的叫法**（src/shared/lang/tags.ts 没收的，盖尔语数据里有）：emphatic 强调形（516 处）、elision 省音（猜原形时给的）、
  dialectal 方言、possessive、diminutive、no-plural 没有复数（509）、with-dative 接与格、with-genitive 接属格、
  triggers-lenition 引起弱化、idiomatic 惯用、indeclinable 不变格、derogatory、poetic、historical、Lewis、Canada……
- **x 的叫法**：ety 词源、vn 动名词、vnOf 是……的动名词、ipaDialects 方言读音、formIpa 词形读音（已经是可读的文字列表）。
- **阅读器的 IPA 注音**（ruby = 'ipa'）：变过形的词不要用原形的 IPA（bhàta 读 [ˈvaːʰt̪ə]，不是 [ˈpaːʰt̪ə]）：先看 x.formIpa
  （「词形 IPA」，按第一个空格拆开），没有的不注或按规则推；词典页「变形」里也可以显示。
- **一个词形对上同一词条的几行**时，阅读器只取第一行的标签。盖尔语的 bhàta 既是「弱化」又是「定指属格单数」；
  现在把弱化行排在前面（动词除外，动词先报过去式）。以后可以考虑把几行的标签合起来显示。
- **多词说法**：阅读器以后要能认连着的几个词（sam bith、mu dheidhinn、a h-uile），现在靠把不单独成词的那一段挂成词形应付。
- 字母课按 `alphabet: 'phonics'` 做拼读规则课（阶段四再开）。
- 不需要新的 npm 依赖。

## 十、怎么重建

```
node scripts/data/run-ts.mjs scripts/data/gd/build.ts      # 下载（续传）+ 生成 dict.sqlite + zh-todo.txt
node scripts/data/run-ts.mjs scripts/lang/validate.ts gd   # 校验
npx vitest run tests/lang/gd                               # 测试（有词典库时会查库）
```

改了 `rules.ts` 的 key / looseKey 要重建；改了维基百科的去标记规则要改 freq.ts 里缓存的版本号。
对不上词条的语料词（补词用）写在 `.cache/data/gd/unmatched.json`。
