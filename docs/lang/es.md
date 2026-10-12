# 西班牙语（es）

> 2026-10-12 进度更新：已接入阅读、语法词典、六类课程、本文练习、自测卷、字幕查词、录音与统计。
> 当前 116,703 个词条、72 个语法点、144 个双语教学例句、6 篇读物、6 套自测卷。
> 拼读与重音、变位、宾语代词、时态对照和虚拟式。
> 下文的「阶段一」「要框架做的」为历史记录；现行范围、限制和下一阶段以 [多语言进度](../multilingual-progress.md) 为准。

> 进度记录：阶段一（资料、特点与词典数据）进行中。正文分几节，随做随补；中断时看「进度」一节接着做。

## 进度

- 2026-10-09 18:40 起：调研资料、核实许可、实际请求各新闻 RSS；原始数据已下到 `.cache/data/es/`
  （英文维基词典西语 95 MB、西语维基词典 108 MB、中文维基词典西语两份 11 MB、Tatoeba、wordfreq、doozan 词频、
  OpenCC 字表、ELELex〔只作校准，不进库〕）。
- 已写：`src/shared/lang/es/phonology.ts`（音节、重音、按规则推 IPA，分 distinción / seseo、yeísmo / lleísmo）、
  `scripts/data/es/util.ts`（按行读 gz/bz2、可续传下载、msgpack 解码）、`scripts/data/es/sources.ts`（来源登记）、
  `scripts/data/es/wiktionary.ts`（读英文维基词典的西语词条）。
- 接下来：中文释义（中文维基词典人工条目 + 西语维基词典翻译表里的汉语对译词）、词频与分级、例句、录音、
  build.ts 写库、rules.ts 与测试、zh-todo.txt、把本文写全。
