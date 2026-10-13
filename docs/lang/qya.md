# 昆雅语（qya）

2026-10-13：作为默认内置学习包接入。ISO/BCP-47 代码 qya。学习对象为托尔金的昆雅语；原创教学采用明确标记的 Neo-Quenya 用法，不能声称是托尔金本人给出的完整、最终语法。

## 来源与许可

- [Eldamo](https://eldamo.org/)，Paul Strack，词汇 XML 当前版本 0.8.13，CC BY 4.0。下载地址为 [eldamo-data.xml](https://eldamo.org/content/data-model/eldamo-data.xml)。根据站点首页和 XML 头部的明确许可改编词汇事实；保留作者、来源网址、原始文献编号、时期和可靠性标记。原文件 SHA256 及导入数见 `data/qya/import-report.json`。
- [Eldamo 记号说明](https://eldamo.org/general/terminology-and-notations.html)、[入门说明](https://eldamo.org/general/getting-started.html)、[基础语法](https://eldamo.org/content/words/word-2572221327.html)和[Introductory Quenya](https://eldamo.org/intro-quenya/index.html)：用于核对规则和选定词例。教学说明、例句及短篇是 Qonsona 原创，MIT；不复制课程章节、练习或长篇作品。
- [Parf Edhellen / Elfdict](https://www.elfdict.com/about)：交叉核对用外链，未抓取/再分发整站数据库或用户文章。该站包含不同作者、词典和时期的材料；网站开源不等于所有贡献材料都可任意打包。
- [Tolkien Estate：Carl Hostetter 的语言介绍](https://www.tolkienestate.com/scholarship/carl-hostetter-tolkiens-invented-languages/)及[Arden Smith 的文字介绍](https://www.tolkienestate.com/scholarship/arden-smith-writing-systems/)：官方背景资料外链，不复制文章、图片、字体、录音。Eldamo 的开放许可也不授予第三方书籍、字体或录音的使用权。

## 语言与资料的特点

昆雅语通过名词格、数和动词时态/人称后缀表达关系。中文学习者应分开学习词干和实际词形，尤其不可把一条规则机械应用于所有不规则词。长元音有区别意义；分音符 ë/ö 不表示长元音。Tolkien 在不同时期更改过语法和词汇，早期 Qenya 与中期材料不是晚期 Quenya 的同义替换库。

词典包含 q、mq、eq、nq 的词汇记录，分别标为 late、middle、early、neo。`! # * ^ ? ‽ - † ⚠ |` 等记号保留并映射为可显示的可靠性标签。无可靠性标记且有原文引用的记录显示“有托尔金文献引用”，不替所有词声称“官方认证”。Neo 下的无标记词也不会自动标成托尔金直接见证。

## 实际覆盖

- Eldamo 0.8.13 全量选定语言的词汇导入：13,596 条；晚期 3,290、Neo 3,389、中期 2,717、早期 4,200。它是跨时期学术词库，不是 13,596 个能在同一会话体系中随意混用的词。
- 原词条的 `ref/inflect` 提供实际文献词形；不泛造屈折表，不展开包含括号、斜杠等不确定选择的形式，不把被否定、推测或构拟的 reference 当作可靠词形。直接子引用不会吸入嵌套早期词条的变形。
- 24 个教学语法点，48 个双语原创例句：冠词、普通复数、形容词、不定时/现在时、人称与数、将来、命令、趋向/处所/离向/与/属/所有格、所有后缀、过去、完成、并列和关系句。
- 24 项拉丁转写拼读；8 项核对词形练习；8 项简短表达；3 篇原创短阅读；L1–L3 各一张六题结构自测。词典内原创例句去重后 51 条。
- `alta` 采用中期形容词“大”（保留中期标签），不混入晚期名词“光辉”，也不误译为“高”。`osto` 采用核对的晚期“要塞”义。
- 精选基础词的中文释义为人工编辑，来源标为 Qonsona。全量词典保留 Eldamo 英文释义，未假装全部已译成中文。具体已匹配词数与未匹配清单见导入报告；没有来源匹配的精选请求不会造词入库。
- 系统朗读接软件离线 qya 引擎，属于合成近似音色，不是 Tolkien 原作录音。词典没有把合成结果伪装成原始 IPA 或真人录音。

L1–L3 是软件内部学习顺序，不是 CEFR、官方等级或官方考试。词库中未选入精选教学词表的词保持未分级；没有用源码顺序伪造词频。没有臆造精灵语新闻 RSS。

## 转写、词形和数据结构

严格键保留元音长度；昆雅语分音符可省略，c/k 及长元音的宏音符/锐音符作有说明的转写规整。宽松键去附加符号，仅作退路查词，不能据此说长短元音相同。切词保留原文 UTF-16 起止和全文覆盖。

词典 `x.eldamo` 保存 `id, sourceHead, language, period, mark, status, category, url, creator, references, aliases, deprecated, glossMark`。同形词的上标数字只从检索词头移除，原始写法仍存于 `sourceHead`；不同词条不合并。词本只有三组学习阶段和四组具双语标题的时期分类，源码语义分类仍保留在 x，而不占据数百个默认词本。

精选教学词通过 `core-bindings.json` 的具体 Eldamo 页面 ID、词性、英文语义词边界及时期联合校验后才附中文释义和等级。中期与 Neo 词保留实际标签；同形词不会依词头或源码顺序挪用另一个词条的中文。阅读器对这两门语言优先经过核对的教学词条，再按晚期、Neo、中期、早期排列，其余语言查词顺序不变。

实际新增文献别名索引 2,639 个，来自 1,941 个词条；已核对并分级的核心词 52 条。

无变形标记的直接文献引用中，确有出处、未否定、未存疑、未被改正的具体单词写法也建立检索别名，保留 `x.eldamo.aliases` 的时期和逐条出处。它们标为文献写法而非生成的变形；括号选择、斜杠或多词短语不展开。

语法识别 patterns 是核对过的教学表层片段识别，不是一般昆雅语句法分析器。准确例句匹配不能证明对任意文学材料都有完整语法覆盖。

## 构建与检查

```text
python scripts/data/eldarin/seed-content.py  # 可选：修改教学内容后重新生成；正常建库使用已入库 JSON
node scripts/data/run-ts.mjs scripts/data/eldarin/build.ts --download
node scripts/data/run-ts.mjs scripts/lang/validate.ts qya
node node_modules/vitest/vitest.mjs run tests/lang/eldarin.test.ts tests/lang/multilingual-content.test.ts -t "qya|sjn|Eldamo"
```

首次下载完整 XML；之后不加 `--download` 使用缓存。通过统一 LexDbWriter 建 SQLite，写到 building 文件后完成索引并换入新库。只在隔离开发目录运行，不修改运行实例的用户数据。

## 明确的后续工作

当前文字课教拉丁转写，没有完整 Tengwar 字母课、字体包或转写器。Tengwar 需选择具体 mode，且所见网页字体不能直接搬用。后续可补分 mode 的书写课、更多经过核对的原创阅读/会话、更多人工中文释义和词干分析；不能把跨时期词形自动补成统一的规范变位表。
