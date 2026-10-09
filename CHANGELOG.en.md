# Changelog

## 0.1.0 · 2026-10-09

The first public release. Qonsona (formerly Qonlang Study) is a desktop app for learning languages: Japanese first (JLPT N5–N1), and the languages you build in Qonlang can be imported as study packs. There are no AI features — questions, example sentences and levels are all generated from the dictionaries and the project data.

### Japanese

- **Dictionary**: all 219,000 JMdict entries, searchable by writing, kana, romaji, inflected forms (食べさせられなかった) and English or Chinese meanings; Chinese meanings translated from the English ones plus the Tomoshi open data; Tatoeba example sentences with translations; kanji with stroke-order animations, on and kun readings and Chinese meanings; Chinese–Japanese false friends, transitive–intransitive verb pairs, Japanese definitions from the Japanese Wiktionary and Chinese ones from the Chinese Wiktionary; handwriting lookup; a **Grammar** tab with all 319 grammar points from N5 to N1
- **Reading**: the home page is a vertical news feed (public headlines and leads from NHK News); the library has 22 public-domain works from Aozora Bunko, and you can paste an article, open a text file or drop one in; furigana or romaji, underlines by JLPT level, click a word to look it up, sentence-by-sentence reading aloud; every article has its vocabulary, grammar and a practice set, and you can paste your own translation for a bilingual view
- **Courses**: kana, verb and adjective forms, conversation, idioms, JLPT grammar (78 lessons from N5 to N1) and folk tales (14 stories); every lesson ends with practice and every unit with a test
- **Word lists and review**: JLPT N5–N1 word lists and 25 topic lists; spaced review with three answers (Don’t know / Vaguely / Know it), with your own daily limits for new words and reviews
- **Practice and mock tests**: kanji readings and writings, meanings, fill-in-the-blank, grammar, conjugation, sentence comprehension and listening, by JLPT level, each with an explanation; N5–N1 mock tests in timed sections like the real JLPT, scored the JLPT way when you hand them in (for reference only)
- **Video and audio**: your own video and audio files with subtitles (SRT, VTT, ASS, LRC); the current line with furigana and clickable words, repeat, loop a line, pause after each line, playback speed, hidden subtitles for listening practice

### Languages from Qonlang

- Import a Qonlang project (.laim.json) or a .qstudy.json from Qonlang's “Export study pack”: each language in the project becomes a language you can learn, together with the author's lessons, hidden items, fixed levels, default script and recordings
- Dictionary (inflection tables, etymology, morphemes, examples), reading with word-by-word glosses, alphabet / grammar document / inflection / phrase courses, word lists and review levelled by word frequency, practice (meanings, listening, inflected forms, sentences, sound changes)
- Pronunciation plays your own recording first, then the author's, and otherwise reads the IPA with a Windows system voice

### Other

- Statistics: streaks, time spent each day, words and grammar learned, practice accuracy, best mock test scores
- Backup and restore (one zip file); Chinese and English interface; system, light and dark themes; in-app updates (installed Windows versions download only what changed)
- If you used Qonlang Study: the first time Qonsona starts it copies your study data (preferences, study packs, word lists, course progress, recordings and so on); the old data folder is left as it was, and backups made before the rename can still be restored
- The macOS version is not signed; see the README for how to open it the first time. Reading aloud with system voices is only available on Windows for now; your own and the author's recordings play on macOS as usual

The detailed log of the development milestones (internal versions 0.1.0–0.7.0) is in [docs/milestones.md](docs/milestones.md) (Chinese).
