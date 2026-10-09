# 苏格兰盖尔语（gd，Gàidhlig）

> 进度（2026-10-09）：阶段一进行中。规则（查词键、切词、猜原形、词首音变）与测试已完成；
> 资料调研完成（见下「资料清单」）；数据管线 `scripts/data/gd/` 在写。

## 资料清单（调研结果，管线写完后补全数字）

| 资料 | 许可 | 地址 | 用途 | 这台电脑 |
|---|---|---|---|---|
| 英文维基词典 Scottish Gaelic（kaikki.org / wiktextract，enwiktionary 2026-09-02） | CC BY-SA 4.0 | https://kaikki.org/dictionary/Scottish%20Gaelic/ | 词条、英文释义、IPA、变形表（变格、变位、弱化）、例句 | 能下，29.3 MB |
| 中文维基词典「蘇格蘭蓋爾語」（kaikki.org，zhwiktionary 2026-10-01） | CC BY-SA 4.0 | https://kaikki.org/zhwiktionary/ | 321 个词的中文释义 | 能下，0.5 MB |
| Unified Scottish Gaelic Wordnet v0.9 | CC BY-SA 3.0 | http://ukc.disi.unitn.it/index.php/gaelic/ | 10,139 个盖尔语词的同义词集（对齐 Princeton WordNet 3.0）与 8,936 条盖尔语释义 | 能下，0.3 MB |
| Chinese Open Wordnet（OMW 数据） | WordNet 式许可（可再分发，保留版权声明） | https://github.com/omwn/omw-data/tree/main/wns/cow | 同义词集的中文词 → 盖尔语词的中文释义 | 能下，2.5 MB |
| Princeton WordNet 3.0（OMW 数据） | WordNet 许可 | https://github.com/omwn/omw-data/tree/main/wns/eng | 同义词集的英文词，用来把中文对到维基词典的义项 | 能下，5.8 MB |
| UD Scottish Gaelic ARCOSG | CC BY-SA 4.0 | https://github.com/UniversalDependencies/UD_Scottish_Gaelic-ARCOSG | 8.6 万词、人工标的原形：词频、歧义词形的分配、测查词覆盖率 | 能下，5.9 MB |
| LearnGaelic 语料词频表（innesmck/GaelicFrequencyLists） | MIT（只用词频，不用原文） | https://github.com/innesmck/GaelicFrequencyLists | 《Litir do Luchd-ionnsachaidh》与 Watch Gaelic 字幕的词形频次（各前一万） | 能下，0.4 MB |
| 盖尔语维基百科 Uicipeid（2026-10-01 dump） | CC BY-SA 4.0 | https://dumps.wikimedia.org/gdwiki/ | 词频；以后的阅读文章 | 能下，10 MB（要断点续传） |
| Tatoeba 盖尔语句子 | CC BY 2.0 FR | https://downloads.tatoeba.org/exports/per_language/gla/ | 1,052 句，挑可靠的贡献者；英文翻译、经英文转接的中文翻译 | 能下 |
| BBC Naidheachdan RSS | BBC 版权；条款第 15 条允许不改动地展示 RSS 并注明出处 | https://feeds.bbci.co.uk/naidheachdan/rss.xml | 阶段二：新闻标题与导语 | 能取到（19 条） |

放弃：Am Faclair Beag、LearnGaelic 词典（版权，只做外部链接）；Dwelly-d 数字版（没有开放许可）；
An Crúbadán（CC BY 4.0，但 crubadan.org 从这台电脑连不上）。
