# 韩语（ko）

分支 `lang/ko`，worktree `Documents\GitHub\Qonsona-wt\ko`。约定见 [../lang-kit.md](../lang-kit.md)。
这份文档随做随记：特点分析、资料清单（许可）、分级、规则、进度、待定问题。

## 进度

| 日期 | 做了什么 |
|---|---|
| 10-09 | 调研资料（下面的清单，许可与下载都实际核过）；韩文字母拆合（`hangul.ts`）、标准发音与罗马字（`pronounce.ts`，跟한국어기초사전 4.6 万个词的发音比对，一致 94.9%）、读한국어기초사전 XML（`scripts/data/ko/krdict.ts`）、谓词词尾表（`endings.ts`，写到一半） |

## 资料清单（2026-10-09 从这台电脑实际取过）

| 资料 | 许可 | 地址 | 取什么 | 能否再分发 |
|---|---|---|---|---|
| **한국어기초사전**（国立国语院《韩国语基础词典》）整本 XML，2026-09-19 版 | CC BY-SA 2.0 KR（文字）；录音、图片、视频各自另有许可，**不取** | <https://krdict.korean.go.kr/> 页脚「사전 전체 내려받기」→ `https://krdict.korean.go.kr/dicBatchDownload?seq=216`（XML，63 MB；217 是 JSON 84 MB，215 是 Excel 70 MB）。**不用登录**，约 240 KB/s | 词头、品词、汉字（原语）、发音、活用形、词汇等级（초급/중급/고급）、意义类别、韩语释义、**中文与英文译文**（逐义项）、例句（短语、句子、对话）、近义反义 | 能（署名「国立国语院 한국어기초사전」，同样许可） |
| 2017 年《国际通用韩国语标准教育课程适用研究（4 阶段）》词汇、语法等级表 | 公共누리 第 1 类型（注明出处即可自由使用，含商用、改编） | <https://www.korean.go.kr/front/reportData/reportDataView.do?mn_id=45&report_seq=932> 附件 xlsx | 10,635 个词的 1–6 级（735 / 1,100 / 1,655 / 2,200 / 2,365 / 2,580）；336 个语法项目的 1–6 级 | 能（注明出处） |
| 2003 年《韩国语学习用词汇目录》（国立国语研究院） | 公共누리 第 1 类型 | <https://www.korean.go.kr/front/etcData/etcDataView.do?mn_id=46&etc_seq=70>（txt，EUC-KR） | 5,965 个词的 A/B/C 三级（982 / 2,111 / 2,872）与 2002 年《现代国语使用频度调查》的频度名次 | 能（注明出处） |
| 英文维基词典的韩语词条（kaikki.org / wiktextract） | CC BY-SA 4.0 / GFDL | <https://kaikki.org/dictionary/Korean/kaikki.org-dictionary-Korean.jsonl.gz>（21 MB，10-03 抽取） | 63,773 条：英文释义、罗马字、IPA（40,123 条）、汉字（18,553 条）、活用表（ko-conj）、少量录音（25 条） | 能 |
| 中文维基词典的「朝鲜语」词条（kaikki.org） | CC BY-SA 4.0 / GFDL | `https://kaikki.org/zhwiktionary/朝鲜语/…jsonl.gz`（6.5 MB）、`朝鮮語`（3.2 MB） | 人写的中文释义（补기초사전没有的词） | 能 |
| Tatoeba 例句 | CC BY 2.0 FR | <https://downloads.tatoeba.org/exports/per_language/kor/> | 韩语 15,941 句；韩中对照 2,844 条（2,614 句有中文）、韩英 11,599 条（10,727 句有英文） | 能 |
| 词频：FrequencyWords（OpenSubtitles 2018 字幕） | 内容 CC BY-SA 4.0 | <https://github.com/hermitdave/FrequencyWords>（`content/2018/ko/ko_full.txt`，68.8 万个语节） | 语节（어절）频度，按还原规则归到原形 | 能 |
| 词频：wordfreq | 数据 CC BY-SA 4.0 | `wordfreq/data/small_ko.msgpack.gz` | 约 3 万个词素（按词素切过：좋、같、했、습니다……）的频度 | 能 |
| Unihan | Unicode 许可 | <https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip> | 汉字的韩语读音（kHangul）、释义 | 能 |
| OpenCC 繁简对照 | Apache 2.0 | `BYVoid/OpenCC data/dictionary/TSCharacters.txt` | 汉字词的汉字用繁体（學校），中文用户输入简体（学校）也要查得到 | 能 |
| 录音：Lingua Libre（维基共享资源） | 多为 CC BY-SA 4.0（逐个文件核） | `Category:Lingua Libre pronunciation-kor`（1,024 个以上） | 词的真人录音（阶段六前后接） | 能（署名录音人） |

### 新闻 RSS（10-09 从这台电脑请求过；有版权，只取标题与导语，附原文链接）

| 来源 | 地址 | 结果 |
|---|---|---|
| 연합뉴스 | `https://www.yna.co.kr/rss/news.xml` | 200，120 条，导语截断约 80 字；版权声明「무단 전재-재배포, AI 학습 및 활용 금지」 |
| 경향신문 | `https://www.khan.co.kr/rss/rssdata/total_news.xml` | 200，50 条，导语约 200 字 |
| 한겨레 | `https://www.hani.co.kr/rss/` | 200，30 条，description 只有图片，只能取标题 |
| SBS | `https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=01&plink=RSSREADER` | 200，29 条 |
| MBC | `https://imnews.imbc.com/rss/google_news/narrativeNews.rss` | 200，20 条 |
| 동아일보 | `https://rss.donga.com/total.xml` | 200，50 条（7.5 秒，慢） |
| 매일경제 | `https://www.mk.co.kr/rss/30000001/` | 200，50 条 |
| 뉴시스 | `https://www.newsis.com/RSS/sokbo.xml` | 200，100 条 |
| 서울신문 | `https://www.seoul.co.kr/xml/rss/rss_top.xml` | 200，26 条 |
| KBS | `news.kbs.co.kr/rss/…`、`world.kbs.co.kr/rss/rss_news.htm?lang=k` | 404 或空——没找到能用的 |
| 정책브리핑（korea.kr，公共누리） | `https://www.korea.kr/rss/policy.xml` | 404，地址待查（全文若是公共누리 第 1 类型可收全文） |

## 待定（需要用户拍板的事；先按稳妥的默认做）

（随做随记）
