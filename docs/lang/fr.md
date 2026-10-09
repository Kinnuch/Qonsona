# 法语（fr）

分支 `lang/fr`，工作目录 `Documents\GitHub\Qonsona-wt\fr`。约定见 [lang-kit.md](../lang-kit.md)。
这份文档随做随记：进度、来源、待定问题都在这里，中断了别人能接着做。

## 进度

| 阶段 | 状态 |
|---|---|
| 一：资料、特点与词典数据 | 进行中：资料已调研、下载；规则（rules.ts）与单测已写；数据管线在写 |
| 二：阅读与新闻 | 未开始（新闻源已实测，见「新闻」） |
| 三～八 | 未开始 |

### 进度日志

- 10-09 18:40 起：读约定、调研资料、下载原始数据（`.cache/data/fr/`，约 3.6 GB，含 2.98 GB 的英文维基词典整份原始抽取）。
- 10-09 19:20：`src/shared/lang/fr/rules.ts`（查词键、宽松键、切词、猜原形）与 `tests/lang/fr/rules.test.ts`（13 个测试）通过。
- 10-09 23:15：额度恢复后接着做；先提交一次。

## 待定（需要用户或主线拍板；先按括号里的默认做法做）

1. **FLELex 是 CC BY-NC-SA 4.0**（核实于官网下载页）。它是法语 CEFR 分级词表里最好的（按 FLE 教材统计）。
   约定说 NC 的能不用就不用。**默认：不进库**，只拿来核对、校准按词频切的级别（见「分级」）。
   若主线认为软件免费、非商用可以接受 NC，管线留了开关可以直接换成 FLELex 的级别（要在设置的来源里写明 NC）。
2. CFDICT 的许可要求「在应用里和应用的介绍页上都注明来源网站 chine.in」。数据来源会进设置里的「数据来源与许可」，
   **介绍页（README、发布说明）也要加一行**——这是主线的文件，汇报里提出。
3. 维基共享资源的录音许可逐个文件不同（多数 CC BY-SA 3.0/4.0，Lingua Libre 一律 CC BY-SA 4.0），
   kaikki 的数据里没有逐个文件的许可与作者。**默认：`au` 只记地址与口音标签，署名统一写「Wikimedia Commons 贡献者、
   Lingua Libre 贡献者（各文件许可见其页面）」**；以后要逐条署名，得另从 Commons API 批量取（这台电脑连 Commons API 会被限速）。

## 一、法语的特点（跟日语哪里不一样）

（下面一节随数据做完补全）

## 二、资料清单

全部在 10-09 从这台电脑实际请求过；下载的都在 `.cache/data/fr/`（不入库），旁边的 `*.json` 记着地址、ETag、下载时间。
`node scripts/data/run-ts.mjs scripts/data/fr/download.ts [id…]` 重新下载（12 路分段并行、断点续传）。

### 词典、词表

| id | 资料 | 许可 | 取了什么 | 再分发 | 大小 / 速度 |
|---|---|---|---|---|---|
| enwikt | 英文维基词典的法语词条，kaikki.org（wiktextract）`dictionary/French/kaikki.org-dictionary-French.jsonl.gz`，2026-10-03 抽取 | CC BY-SA 4.0 / GFDL | 词性、性、英文释义、IPA、变位与变格表（动词 64 格）、录音地址（Commons、Lingua Libre，带口音/地区标签）、带英译的例句、近义反义 | 可以（署名、相同方式共享） | 58 MB（解压 584 MB），40.3 万条，其中 9.8 万条不是「某词的变形」 |
| frwikt | 法语维基词典的法语词条，kaikki `frwiktionary/Français/…jsonl.gz`，2026-10-02 | CC BY-SA 4.0 / 3.0 | 法语释义（单语 `mono`）、译成中文的对照表（按义项，`translations` 里 `lang_code=zh`，1.18 万词条 1.59 万条）、IPA、录音（19.7 万词条有 Lingua Libre 录音）、领域（topics）、语体标签 | 可以 | 392 MB（解压 3.1 GB），211 万条（大半是变位形式的页面） |
| zhwikt | 中文维基词典的法语词条，kaikki `zhwiktionary/法语`、`法語` 两个分类 | CC BY-SA 4.0 / 3.0 | 人写的中文释义（简体、繁体各约 1.5 万个原形词条） | 可以 | 4 MB + 5.8 MB |
| enwiktRaw | 英文维基词典整份原始抽取 `dictionary/raw-wiktextract-data.jsonl.gz`（2026-09-02 的 dump） | CC BY-SA 4.0 / GFDL | 只用**英语词条的翻译表**：同一英文义项下的法语译词与汉语（普通话）译词对上，得到法汉对照 | 可以 | 2.98 GB（解压约 24 GB）；按语言分好的英语文件把翻译表去掉了，只能下整份 |
| lexique3 | Lexique 3.83（lexique.org，New & Pallier 等） | CC BY-SA 4.0 | 14.2 万词形：原形、词性、性数、变位信息（`ind:pre:3s`）、音位；电影字幕与书籍两份词频 | 可以 | 27 MB |
| lexique4 | Lexique 4.1（2026-09-29 发布） | CC BY-SA 4.0 | 19 万词形：3.16 亿词的字幕语料词频、语境多样性（CD）、IPA、词形结构、知晓率（prevalence，11.5 万词形有） | 可以 | 49 MB |
| cfdict | CFDICT 汉法词典（chine.in，David Houstin），`assets/cfdict/cfdict.u8`，版本 2024-12-14，约 5.6 万条 | CC BY-SA 3.0；**要求在应用及其介绍页注明 chine.in** | 汉→法，反查成法→汉 | 可以（署名、相同方式共享） | 3.5 MB |
| cedict | CC-CEDICT（MDBG） | CC BY-SA 4.0 | 中文词的英文意思：给 CFDICT 反查出的中文候选词按英文义项排先后（三角对照） | 可以 | 4 MB |
| jieba | 结巴分词词频表 | MIT | 只用来给中文候选词排先后，不进库 | — | 1.9 MB |
| flelex | FLELex（CEFRLex，UCLouvain CENTAL）CRF 版 1.79 万词、TreeTagger/Beacco 版 1.42 万词 | **CC BY-NC-SA 4.0** | **不进库**；只用来核对、校准级别 | 非商用才行 | 1 MB + 0.7 MB |

调研过、没用的：
- 法语维基词典的整份原始抽取（703 MB）：按语言分好的 `Français` 文件已经够用。
- Morphalou 3.1（ATILF，LGPLLR）：97 万词形，比 Lexique 全，但许可是 LGPL-LR、要从 ORTOLANG 下；维基词典的变位表已经全了，先不用。
- Dicollecte / Grammalecte 词库（MPL 2.0）：拼写检查用，没有词频，先不用。
- Gougenheim《Français fondamental》（1954）词表：OpenLexicon 上只有前 1064 词的频率，出版物仍受版权保护，不用。
- Éduscol「Liste de fréquence lexicale」（Étienne Brunet 的约 1500 词）：© 教育部，未开放许可，不用。
- Manulex（小学课本分年级词频）：OpenLexicon 只有说明，数据许可不明，不用。
- Français interactif（得克萨斯大学奥斯汀分校的开放教材，CC BY 3.0）：每章有词汇表，可以做 A1–A2 的教材词表（只有 PDF，
  要解析两栏排版）；放在「分级」的后续工作里。

### 例句、录音

| 资料 | 许可 | 取了什么 | 备注 |
|---|---|---|---|
| Tatoeba `per_language/fra`（2026-10-03 导出） | CC BY 2.0 FR（另有一部分 CC0） | 法语句子（`fra_sentences` 9.8 MB）、法中对照（`fra-cmn_links`）、法英对照（`fra-eng_links`）、中文与英文句子 | 例句与中英翻译 |
| Tatoeba `fra_sentences_with_audio` | 每条录音各自的许可（CC BY、CC BY-NC……） | 只记清单，阶段六再看 | — |
| Wikimedia Commons / Lingua Libre 录音（经维基词典） | Lingua Libre 一律 CC BY-SA 4.0；其他 Commons 文件逐个不同 | `au`：录音地址（mp3 转码地址，带口音/地区标签） | lingualibre.org、datasets.lingualibre.org 要 HTTP/2，curl 连不上；Commons API 被限速（429）。录音地址直接取自维基词典数据，不用另连 |

### 公有领域文本（阶段二的课文、故事）

- 法语维基文库（fr.wikisource.org，71.8 万篇，可连）：拉封丹《寓言》、佩罗《鹅妈妈故事》、都德《磨坊书简》、
  莫泊桑短篇、凡尔纳、雨果……作者都去世超过 70 年。
- 古登堡计划（gutenberg.org，可连；目录 `cache/epub/feeds/pg_catalog.csv.gz`，40 秒）。
- Ebooks libres et gratuits、Bibebook（公有领域作品整理本，可连；各自的整理许可要再看）。
- Vikidia（儿童百科，CC BY-SA）：**从这台电脑连不上**（Cloudflare 人机验证 403），不绕过。

### 新闻（阶段二；10-09 23:00 前从这台电脑逐个请求）

有版权的只取 RSS 里的标题与导语，附原文链接（日语 NHK 的做法）。

| 来源 | RSS 地址 | 结果 |
|---|---|---|
| RFI 法语 | `https://www.rfi.fr/fr/rss` | 200，24 条，有导语，1 秒 |
| RFI 非洲 | `https://www.rfi.fr/fr/afrique/rss` | 200，24 条 |
| RFI「简易法语新闻」Journal en français facile | `https://www.rfi.fr/fr/podcasts/journal-fran%C3%A7ais-facile/podcast`（旧地址 `journal-en-français-facile` 会 301 过来） | 200，24 期，每期 10 分钟 mp3（enclosure）；文字稿在 RFI Savoirs 网页上（有版权，不收全文） |
| France 24 | `https://www.france24.com/fr/rss` | 200，24 条，有导语 |
| Le Monde 头条 | `https://www.lemonde.fr/rss/une.xml` | 200，16 条，有导语 |
| franceinfo | `https://www.francetvinfo.fr/titres.rss` | 200，32 条（标题里有 HTML 实体，要解码） |
| 20 Minutes | `https://www.20minutes.fr/feeds/rss-une.xml` | 200，30 条 |
| Le Figaro | `https://www.lefigaro.fr/rss/figaro_actualites.xml` | 200，19 条 |
| Libération | `https://www.liberation.fr/arc/outboundfeeds/rss-all/?outputType=xml` | 200，50 条 |
| Ouest-France | `https://www.ouest-france.fr/rss/une` | 200，10 条 |
| Radio-Canada（加拿大） | `https://ici.radio-canada.ca/rss/4159` | 200，20 条 |
| RTBF（比利时） | `https://rss.rtbf.be/article/rss/highlight_rtbf_info.xml` | 200，20 条 |
| RTS（瑞士） | `https://www.rts.ch/info/?format=rss/news` | 200，25 条 |
| TV5Monde 资讯 | `https://information.tv5monde.com/rss.xml` | 200，100 条（1.4 MB，导语是 HTML，要清理） |
| 1jour1actu（儿童新闻） | `https://www.1jour1actu.com/feed` | 403，不绕过 |
| 法语维基新闻（CC BY 2.5，可收全文） | API `fr.wikinews.org/w/api.php` | 可连，但几乎停更（活跃用户 10 人，近期没有新稿），只能当存档文章用 |

## 三、分级

（下面一节随数据做完补全）

已核对的数字（FLELex/Beacco 版，14,236 个原形）：A1 1,247、A2 679、B1 1,753、B2 5,088、C1 3,155、C2 2,314。
只按词频（Lexique）切、跟它比：同级 41%、差一级以内 83%。错得最多的是课堂与生活词（stylo、cahier、gomme、mardi 在字幕里不算常见）
和口语粗话（mec、putain、flic 在字幕里很常见）——要用手挑的核心词表和语体标签纠正。

## 四、后面各阶段的打算

（下面一节随数据做完补全）
