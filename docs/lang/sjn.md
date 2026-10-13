# 辛达语（sjn）

2026-10-13：默认内置学习包，ISO/BCP-47 sjn。原创内容属于明确标记的 Neo-Sindarin 学习用法，不能宣称等同托尔金完整、最终的辛达语语法。

## 来源和许可

核心数据来自 [Eldamo](https://eldamo.org/) 的 [开放 XML](https://eldamo.org/content/data-model/eldamo-data.xml)，Paul Strack，版本 0.8.13，CC BY 4.0。文件散列、实际导入数量及精选词匹配结果见 `data/sjn/import-report.json`。署名、文献引用、原词条链接、时期及可靠性保留。不同出版物、字体和录音的权利不因词汇 XML 开放而改变。

核对使用 [基础语法](https://eldamo.org/content/words/word-1765108261.html)、[语法索引](https://eldamo.org/content/grammar-indexes/grammars-s.html)、[发音与转写](https://eldamo.org/content/words/word-4127298049.html)、[记号说明](https://eldamo.org/general/terminology-and-notations.html)。Qonsona 的教学规则说明、短句、短阅读为原创 MIT，不复制现有教材篇章、诗歌或整组练习。

[Elfdict/Parf Edhellen](https://www.elfdict.com/about)仅作为来源核对及进一步阅读链接；该站混合词典和贡献作者，网站开源不是整站材料的统一再分发许可。官方背景资料参见 [Tolkien Estate：Carl Hostetter](https://www.tolkienestate.com/scholarship/carl-hostetter-tolkiens-invented-languages/)和[Arden Smith](https://www.tolkienestate.com/scholarship/arden-smith-writing-systems/)，仅外链，不复制受保护的文章、字体、图像或录音。

## 特点与学习策略

辛达语以首辅音变化、元音变换、词干变化表达大量语法关系。名词复数不是加统一词尾；软变化和鼻音变化不能混用。现代同为 d 的词可能来自不同古辅音，不能只看拼写猜出正确变化。c 恒读 /k/；ch、th、dh、lh、rh 与英语读法有明显差异；y 是前圆唇元音而非英语辅音 y。

本词库保留 s、ns、n、en、g：晚期 Sindarin、Neo、Noldorin、Early Noldorin、Gnomish。早期/中期材料用于比较，不是无需说明便可搬进晚期会话的标准词。每条 `x.eldamo` 保留原语言码、时期和文献，记录可靠性、构拟、新造、否定与编辑标记。带文献不等于所有用法都最终定型。

## 实际覆盖

- 全量选定语言的词汇记录共 10,150 条：晚期 2,126、Neo 1,610、中期 1,943、早期 4,471。排除语法/音系论文条目及长文本/诗篇，不复制教材正文。
- 只从当前词条直接 `ref/inflect` 取具体文献词形，保留原始标签。不把早期嵌套记录的词形合入晚期记录；不猜出缺失的不规则形，不展开文献中不确定的斜杠/括号组合。
- 24 个语法点，48 个双语原创例句：单复数冠词、无不定冠词、核对名词复数、p/b/c/d/g/m 的软变化、p/t 的鼻音变化、后置形容词和数的一致、第一人称、命令、动名词、零系词、并置属关系、所有词、并列、古 nd 词与 1969 CEA 冠词体系辨读。
- 29 项拉丁转写拼读，8 项核对词形练习，8 项简短表达，3 篇原创 Neo 短阅读，L1–L3 各一份六题结构自测。词典中原创双语例句去重后 49 条。
- 核心精选词的中文为人工编辑，完整库其余词保持真实英文释义；没有凭空给每个词生成中文。精选请求不能可靠匹配时记录未匹配，不造词填空。
- 软件的 sjn 离线朗读为合成近似声音；不是作者或电影原音。当前没有把合成发音写成来源词典提供的录音/IPA。

## 体系选择必须可见

普通长元音 á/é/í/ó/ú 与单音节超长元音 â/ê/î/ô/û 分开教学；超长元音的 IPA 与合成时长仅作近似。真实文献 `tôl` 不自动添造 `tól`，未直接见证的复数动词 `telir` 不用于本课程短句；复数冠词与名词练习采用名词短语。

一般例句采用常见单数 i、复数 i(n) 的 Neo 教学惯例。单独一课比较 1969 CEA 的单数 e(n)，不在同篇普通教学短句里静默混用。代词、命令、动名词等细节存在文献和学者分析差异；所给教学句是原创 Neo 例句，不能标为 Tolkien-attested。

L1–L3 是软件内部顺序，无 CEFR 或官方考试对应；没有声称学习这些短句就可获得自然语言式的全技能等级。大多数学术词条未分级，不据源码顺序制造词频。没有虚构新闻源。

严格检索保留长度与原始音值，只规整明确的 documentary ð/dh、þ/th 和宏音符/锐音符等转写关系。开头表示 g 消失的撇号作为标记处理，切词仍保留它的起止；宽松去附加符号仅作查词退路。patterns 是教学表层片段识别，不是完整辛达语形态或句法分析器。

精选教学词通过 `core-bindings.json` 的具体 Eldamo 页面 ID、词性、英文语义词边界及时期联合校验后才附中文释义和等级。中期与 Neo 词保留实际标签；同形词不会依词头或源码顺序挪用另一个词条的中文。阅读器对这两门语言优先经过核对的教学词条，再按晚期、Neo、中期、早期排列，其余语言查词顺序不变。

实际新增文献别名索引 1,980 个，来自 1,473 个词条；已核对并分级的核心词 49 条。

无变形标记的直接文献引用中，确有出处、未否定、未存疑、未被改正的具体单词写法也建立检索别名，保留 `x.eldamo.aliases` 的时期和逐条出处。它们标为文献写法而非生成的变形；括号选择、斜杠或多词短语不展开。

## 数据和验收

`x.eldamo` 保留 `id, sourceHead, language, period, mark, status, category, url, creator, references, aliases, deprecated, glossMark`。同形编号只从查词头去除，出处头原样保存。默认词本为三学习阶段及四个具中英标题的时期分类，原始语义分类留 x，不显示几百个不透明源码 ID。

```text
python scripts/data/eldarin/seed-content.py  # 可选：修改教学内容后重新生成；正常建库使用已入库 JSON
node scripts/data/run-ts.mjs scripts/data/eldarin/build.ts --download
node scripts/data/run-ts.mjs scripts/lang/validate.ts sjn
node node_modules/vitest/vitest.mjs run tests/lang/eldarin.test.ts tests/lang/multilingual-content.test.ts -t "qya|sjn|Eldamo"
```

SQLite 通过共用 LexDbWriter 写入及建立索引。无本机数据库时只跳过真实库测试，解析、来源标记、原文偏移和课程测试仍执行。

## 剩余工作

目前是完整词库配初始实用学习路径，不是覆盖全部辛达语争议与历史变化的教材。需要继续增加更多原创阅读、解释具体动词类别、补人工中文、做有版本选择的弱化还原；应保持文献证据和 Neo 推导分开。文字课目前教拉丁转写，尚无完整 Tengwar/Cirth mode 课程、字体分发或转写器。
