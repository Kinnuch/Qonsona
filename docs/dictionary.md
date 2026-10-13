# 词典每日推荐与屈折词形 / Daily discoveries and inflection

适用于 Qonsona 0.2.0。支持日语、英语、法语、韩语、西班牙语、阿拉伯语、俄语、苏格兰盖尔语，以及导入的千语集语言。不同语言、词条和学习包具备的资料不同，不以界面入口存在代表全部内容已覆盖。

Applies to Qonsona 0.2.0: Japanese, English, French, Korean, Spanish, Arabic, Russian, Scottish Gaelic and imported Qonlang languages. Available material varies by language, entry and study pack; an available interface does not mean complete content coverage.

## 每日三类推荐 / Three daily categories

打开词典，保持词语查询框为空。页面显示真实词条、库内句子和学习包语法讲解三块；通常分别选择三词、两句和一个语法点，候选不足时只显示已有项。输入查词后推荐收起，不占查询结果的位置。

Leave the dictionary word query empty. The page shows real entries, stored sentences and grammar explanations from the study pack, normally three words, two sentences and one grammar point. Smaller pools show only available items. Searching hides recommendations so they do not occupy the results area.

- 点击词汇打开具体词条；词旁的生词本按钮加入当前语言的“我的生词”。
- 点击句子的查询按钮进入例句查询；有对应语音能力或录音时可朗读。
- 点击语法查看具体讲解；有对应课程时，课程按钮直接打开相应课。
- 使用“推荐日期”选择器回看日期，或回到今天。清空日期会显示提示，重新选有效日期即可恢复。

- Click a word to open its entry; the notebook button adds it to the current language’s personal list.
- Explore a sentence through example search; pronunciation is available where a voice or recording is supported.
- Open the specific grammar explanation, or its related lesson when one exists.
- Use the date picker to revisit a date or return to today. Clearing it shows a recoverable prompt; choose a valid date to resume.

同一语言、同一日期与同一资料池的选择稳定，次日轮换；少量候选可能重复。历史日期按资料重建，不额外保存一份项目内容。升级词典或修改项目后，候选池变化可能改变过去日期的推荐。等级来自已有数据；没有句子等级时显示“未分级”，不把词汇等级冒充句子评级。词典未安装、没有可用例句、没有语法讲解会分别说明。

Selections are stable for the same language, date and content pool, and rotate the next day; small pools may repeat items. Past dates are reconstructed from the material without saving another copy of project content. Dictionary updates or project edits may change earlier recommendations. Levels come from existing data; sentences without levels are shown as unrated, rather than inheriting a word’s rating. Missing dictionaries, example sentences and grammar explanations are reported separately.

千语集推荐从当前项目的当前语言与可见内容生成，排除隐藏项，不上传项目。项目文档可作为语法讲解入口；有作者录音时使用对应录音。个人学习数据的文件转移与合并另见 [转移说明](transfer.md)，每日推荐不提供云同步。

Qonlang recommendations are generated from the current language’s visible local project content, excluding hidden items, without uploading the project. Project documents can provide grammar explanations and author recordings can provide pronunciation. See the [transfer guide](transfer.md) for file transfer and merging of personal progress. Daily recommendations do not provide cloud sync.

## 屈折、变形与缺项 / Forms and missing data

开发/测试版的阿语阅读会从同键词头和已记录词形恢复元音，并优先保留正文显式标音。词缀分析只作用于一个书写词，避免将多个词误合并为变位。未标元音的正文可能对应多个合法读法，当前注音属于词典推定；未知词或无法对齐的变形不显示猜造的读音。读音提示中也标明这一限制。

In the development/test build, Arabic reading restores vowels from a matching headword or recorded form and preserves explicit marks in the text. Affix analysis applies to one written word, preventing words from being merged into a fictitious inflection. Unvocalized text can have several valid readings: ruby is a dictionary-based suggestion, not full contextual diacritization. Unknown words and unaligned forms receive no invented reading, and the ruby tooltip explains this limit.

在词条中点击屈折/词形按钮展开面板。七门新增自然语言按该词实际保存的标签组织词形：例如动词的时态、语气、人称，名词的格、数、性等；并非每种语言或每个词都具备这些维度。阿拉伯语保留从右向左的文字方向。宽表可横向滚动。

Open the forms button in an entry. The seven additional natural languages organize forms using the entry’s actual tags, such as tense, mood and person for verbs, or case, number and gender for nouns. These dimensions are not present for every language or word. Arabic retains right-to-left text direction; wide tables scroll horizontally.

词典记录与规则生成结果分开标明。来源信息可能属于整个词条，不能据此声称每个单独词形均有逐项来源。空格表示资料没有提供，不表示该形式不存在；“没有词形”也可能是词不按此方式屈折，或数据尚不完整。不能从表中缺项推断完整范式。

Dictionary records and rule outputs are labelled separately. Sources may apply to the whole entry rather than each individual form. An empty cell means that the material does not supply a form, not that the form is impossible. An entry without forms may be invariant in that respect or may have incomplete data. Missing cells do not establish a complete paradigm.

日语面板依据 JMdict 的明确词性与软件已有活用规则生成受支持的动词、形容词形式，显示写法、读音与朗读入口；不猜测未支持的特殊活用。名词通常不因性、数、格改变词尾，格关系主要由助词表达。千语集词形继续使用项目中的范式、规则和引擎结果，不自动套用自然语言规则。

Japanese uses explicit JMdict word-class tags and existing conjugation rules for supported verbs and adjectives, with writing, reading and pronunciation controls. Unsupported special classes are not guessed. Noun endings normally do not change for gender, number or case; particles express case relations. Qonlang forms continue to follow the project’s own paradigms, rules and engine results instead of adopting natural-language rules automatically.

## 盖尔语词首音变 / Gaelic initial alternations

盖尔语面板另外展示词首音变的形式、适用条件与来源，区分已有词典形式和条件规则结果。它不是任意词的全部变形表，也不能把形式脱离句法环境使用。来源保留的 `eclipsis` 标签不等于为苏格兰盖尔语生成爱尔兰语式辅音形式；元音词首的 `n-` 条件另作说明。

The Gaelic panel also shows initial alternations with conditions and sources, distinguishing recorded forms from conditional rule outputs. This is not a complete paradigm for arbitrary words, and forms must be interpreted in their grammatical context. A retained source tag such as `eclipsis` does not generate Irish-style consonant forms for Scottish Gaelic; conditions for vowel-initial `n-` are explained separately.

教学内容与目前覆盖范围见 [多语言进度](multilingual-progress.md) 和 [盖尔语记录](lang/gd.md)。推荐与词形面板用于辅助学习，不替代完整教材或官方考试评价。

See the [multilingual progress record](multilingual-progress.md) and [Gaelic record](lang/gd.md) for actual teaching coverage. Recommendations and forms panels support learning; they do not replace a complete textbook or official assessment.
