// English UI text. Must mirror zh.ts key for key (checked by tests/i18n.test.ts).
export default {
  app: {
    name: 'Qonsona',
    tagline: 'Learn any language — including the ones you build in Qonlang'
  },
  common: {
    ok: 'OK',
    cancel: 'Cancel',
    close: 'Close',
    loading: 'Loading…',
    remove: 'Remove'
  },
  nav: {
    home: 'Home',
    reading: 'Reading',
    courses: 'Courses',
    dictionary: 'Dictionary',
    notebook: 'Notebook',
    practice: 'Practice',
    media: 'Media',
    stats: 'Progress',
    packs: 'Languages',
    settings: 'Settings'
  },
  switcher: {
    label: 'Learning',
    none: 'No language selected',
    manage: 'Manage languages'
  },
  home: {
    noPack: 'You are not learning any language yet.',
    noPackHint:
      'Click “Languages” at the bottom left to pick Japanese or import a Qonlang project.',
    goPacks: 'Go to “Languages”',
    contents: 'What this language includes',
    levels: 'Level system',
    scripts: 'Scripts',
    glyphs: '{n} glyphs',
    embeddedFont: 'embedded font',
    sample: 'Sample',
    fromQonlang: 'From the Qonlang project “{name}”',
    importedAt: 'Imported {date}',
    author: 'By {name}',
    course: {
      next: 'Next lesson: {course} · {lesson}',
      done: 'Every lesson in {course} is passed.'
    },
    news: {
      title: 'News',
      articles: 'Articles',
      texts: 'Texts',
      all: 'All articles',
      open: 'Read the article',
      read: 'Read',
      rail: 'News list',
      empty:
        'There is nothing to read yet. Please import an article in Reading, or turn on fetching NHK news in Settings.',
      noTexts: 'This language has no texts to read yet.'
    },
    dock: {
      about: 'About this language'
    },
    review: {
      title: "Today's review",
      counts: '{due} words to review and {fresh} new words today.',
      done: "You're done with today's review.",
      empty:
        'Your notebook is empty: click “Add to notebook” in the dictionary or while reading, or add a built-in list in the notebook.'
    }
  },
  stats: {
    lexemes: 'Entries',
    morphemes: 'Morphemes',
    sentences: 'Sentences',
    phrases: 'Phrases',
    docs: 'Documents',
    paradigms: 'Paradigms',
    phonemes: 'Phonemes',
    orthographies: 'Orthographies'
  },
  features: {
    texts: 'Reading',
    lexicon: 'Lexicon',
    alphabet: 'Alphabet',
    characters: 'Characters',
    grammar: 'Grammar',
    inflection: 'Inflection',
    phrasebook: 'Conversation',
    idioms: 'Idioms',
    stories: 'Stories',
    media: 'Media',
    exam: 'Exams',
    ruby: 'Reading aids',
    romanization: 'Transliteration',
    speech: 'Speech',
    gloss: 'Interlinear gloss',
    etymology: 'Etymology'
  },
  kinds: {
    alphabet: {
      kana: 'Kana',
      glyphs: 'Script',
      phonemes: 'Letters and sounds',
      letters: 'Alphabet',
      phonics: 'Spelling and sounds'
    },
    characters: {
      kanji: 'Kanji',
      glyphs: 'Glyphs',
      morphemes: 'Morphemes',
      hanja: 'Hanja',
      roots: 'Roots'
    },
    ruby: {
      furigana: 'Furigana',
      ipa: 'IPA',
      orthography: 'Alternate spelling',
      romanization: 'Romanization'
    }
  },
  lang: {
    about: {
      data: 'Dictionary: {entries} entries, {examples} example sentences.',
      noData: 'The dictionary data for this language is not installed yet.',
      levels: 'Levels',
      primary: 'Main scale',
      kind: { proficiency: 'Proficiency levels', wordlist: 'Exam and textbook word lists' },
      basis: 'Based on: ',
      sources: 'Data sources and licences'
    },
    packs: {
      data: 'Dictionary {entries} entries · {examples} examples',
      noData: 'Dictionary data not installed yet'
    }
  },
  modules: {
    reading: {
      desc: 'Read articles with furigana; click any word to look it up, with the vocabulary and grammar of each text listed.'
    },
    courses: {
      desc: 'Alphabet, grammar, inflection, conversation, idioms and stories, step by step.',
      sections: {
        alphabet: 'Alphabet',
        grammar: 'Grammar',
        inflection: 'Inflection',
        phrasebook: 'Conversation',
        idioms: 'Idioms',
        stories: 'Stories'
      }
    },
    dictionary: {
      desc: 'Look up entries, characters and example sentences.'
    },
    notebook: {
      desc: 'Collect new words and review them with spaced repetition.'
    },
    practice: {
      desc: 'Auto-generated exercises by level, plus mock exams.'
    },
    media: {
      desc: 'Watch subtitled videos and listen to audio, looking up and replaying line by line.'
    },
    stats: {
      desc: 'Study streak, time spent and progress in each area.'
    }
  },
  audio: {
    playRecording: 'Play my recording',
    playAuthor: "Play the author's recording",
    author: "Author's recording",
    authorHint:
      'The author recorded this in Qonlang and it came with the study pack. Record your own to replace it.',
    removeBodyAuthor: "The author's recording will be played instead.",
    playSynth: 'Read aloud with a system voice',
    record: 'Record',
    stopRecording: 'Stop and save the recording',
    importFile: 'Use an audio file as the recording',
    mine: 'My recording',
    removeTitle: 'Delete recording',
    removeBody: 'After deleting, a system voice reads it aloud instead.',
    saved: 'Recording saved.',
    noMic: 'No microphone is available. Please check that one is connected and allowed.',
    dropped: 'The system voice cannot pronounce {symbols}; they were skipped.',
    failed: 'Could not read aloud: {error}',
    symbol: '“{s}”'
  },
  dict: {
    placeholder: 'Type Japanese, kana, romaji, Chinese or English',
    placeholderQon: 'Type a word, a form, a pronunciation or a meaning',
    tabs: { words: 'Words', characters: 'Characters', sentences: 'Sentences', grammar: 'Grammar' },
    wikt: {
      ja: 'Japanese–Japanese (Japanese definitions)',
      zh: 'Wiktionary (Chinese definitions)',
      source: 'From Wiktionary, written by Wiktionary contributors and used under CC BY-SA.',
      page: 'Open the Wiktionary page'
    },
    handwriting: {
      open: 'Handwriting',
      board: 'Writing pad',
      hint: 'Write one kanji in the box with the mouse, in stroke order. After each stroke the closest characters are listed.',
      strokes: '{n} strokes. Click a character below to add it to the search box.',
      undo: 'Undo a stroke',
      clear: 'Clear'
    },
    grammar: {
      level: 'Level',
      all: 'All',
      inSentence: 'Grammar in this sentence',
      others: 'Other grammar points',
      near: 'Similar meanings',
      openLesson: 'Study it in the grammar course'
    },
    noData:
      'The Japanese dictionary data has not been built yet. When developing, run npm run data:ja in the repository.',
    lex: {
      placeholder: 'Type a {lang} word or form, or an English or Chinese meaning',
      noData:
        'The {lang} dictionary data has not been built yet. When developing, run node scripts/data/run-ts.mjs scripts/data/{code}/build.ts in the repository.',
      via: {
        form: '“{form}” is the {tags} of “{base}”',
        guess: '“{form}” is probably the {tags} of “{base}”',
        variant: 'inflected form',
        loose: 'Matched ignoring accents and diacritics',
        gloss: 'Matched by meaning'
      },
      variant: 'Other spellings',
      audio: 'Recording',
      audioFail: 'The recording could not be fetched. Please check your internet connection.',
      freq: 'Frequency rank {n}',
      forms: 'Forms ({n})',
      examples: 'Examples',
      syn: 'Synonyms',
      ant: 'Antonyms',
      see: 'See also',
      sources: 'Sources: ',
      sentenceHint: 'Type a word or some text to list example sentences containing it.',
      extra: {
        hanja: 'Hanja',
        root: 'Root',
        pattern: 'Pattern',
        aspect: 'Aspect partner',
        len: 'Lenited form',
        plural: 'Plural',
        stress: 'Stress'
      }
    },
    empty: 'Type a word to look it up.',
    history: 'Recent searches',
    noResult: 'Nothing found for “{q}”.',
    kanaHint: 'Read as romaji: “{kana}”',
    inflected: '“{form}” is an inflected form of “{base}”: {reasons}',
    formOf: '“{form}” is the {slot} form of “{base}”',
    common: 'Common',
    otherForms: 'Other forms',
    machine: 'machine translation',
    zhSource: {
      'mt-en':
        'Chinese glosses were translated from the English glosses (machine translation, not reviewed entry by entry).',
      tomoshi: 'Chinese glosses come from the Tomoshi open data (machine translation).'
    },
    seeAlso: 'See also',
    antonym: 'Antonym',
    only: 'Only for: ',
    pair: { vt: 'Intransitive counterpart', vi: 'Transitive counterpart' },
    replay: 'Replay',
    contrast: 'Chinese–Japanese word choice',
    kanjiHint: 'Type a word containing kanji; each kanji in it is listed here.',
    sentenceHint: 'Type some Japanese; sentences containing it are listed here.',
    kanji: {
      on: 'On',
      kun: 'Kun',
      nanori: 'Nanori',
      meaning: 'Meaning',
      pinyin: 'Pinyin',
      strokes: '{n} strokes',
      grade: 'Grade {n}',
      freq: 'Frequency {n}',
      radical: 'Radical {n}',
      words: 'Common words'
    },
    qon: {
      forms: 'Inflection',
      etymology: 'Etymology',
      relations: 'Related words',
      examples: 'Examples',
      notes: 'Notes',
      morphemeHint: 'Type the form or meaning of a morpheme.',
      allomorphs: 'Allomorphs',
      registers: 'Register'
    }
  },
  notebook: {
    intro:
      'Collect new words here and review them with spaced repetition: words you know come back at longer and longer intervals, vaguely remembered ones in a day or two, and forgotten ones a few cards later in the same session.',
    today: '{due} to review, {fresh} new today',
    startReview: "Start today's review",
    nothingToStudy: 'Nothing to study right now.',
    myLists: 'My lists',
    mine: 'My words',
    untitled: 'Untitled list',
    newListName: 'Name of the new list',
    newList: 'New list',
    builtin: 'Built-in lists',
    groups: { jlpt: 'JLPT lists', theme: 'Topics' },
    favorite: "Author's favorites (learn these first)",
    tag: 'Tag: {tag}',
    addBuiltin: 'Add',
    addedBuiltin: 'Added',
    rename: 'Rename',
    drill: 'Flashcards',
    drillHint:
      'Go through this list card by card: new words are learned as usual; words already scheduled for a later day count as a spot check, and “I know it” leaves their schedule unchanged.',
    deleteList: 'Delete list',
    deleteTitle: 'Delete “{name}”',
    deleteBody: '{n} of its words are in no other list; their study records will be deleted too.',
    status: { all: 'All', new: 'New', forgot: 'Forgotten', unsure: 'Unsure', known: 'Known' },
    emptyMine: 'No words yet. Click “Add to notebook” in the dictionary or while reading.',
    empty: 'This list is empty.',
    removeWord: 'Remove from this list',
    showAll: 'Show all {n}',
    dueToday: 'Due today',
    dueIn: 'In {n} days',
    days: '{n} days',
    months: '{n} months',
    years: '{n} years',
    add: 'Add to notebook',
    addHint: 'Add to “My words”',
    inBook: 'In notebook',
    inLists: 'In: {lists} (click to remove from “My words”)',
    added: 'Added to “{list}”.',
    addedMany: 'Added {n} words to “{list}”.',
    removed: 'Removed from “{list}”.',
    grades: { forgot: "Don't know", unsure: 'Vaguely', known: 'Know it' },
    session: {
      review: "Today's review",
      drillOf: 'Flashcards: {list}',
      progress: '{i} / {n}',
      undo: 'Undo',
      undoHint: 'Undo the last answer (Backspace)',
      exit: 'End this session (Esc)',
      soon: 'Again soon',
      next: 'Next',
      keys: 'Keys: 1 don’t know · 2 vaguely · 3 know it · Space next · Backspace undo',
      spot: 'Spot check',
      spotHint:
        'This word is not due yet: “Know it” leaves its schedule unchanged; a miss reschedules it as usual.',
      done: 'Session complete',
      summary: '{n} answers: {right} known, {wrong} not known.',
      back: 'Back to notebook',
      more: 'Another round'
    }
  },
  reading: {
    intro:
      'Click an article to read it: furigana over kanji, words underlined by JLPT level, click a word to look it up, and the vocabulary and grammar of the text on the right.',
    paste: 'Paste an article',
    openFile: 'Open a text file',
    pasteTitle: 'Title (optional)',
    pasteTopic: 'Topic (optional)',
    pasteBody: 'Paste Japanese text here. Aozora Bunko ruby marks are removed automatically.',
    importIt: 'Import and read',
    imported: 'Imported “{title}”.',
    level: 'Level',
    all: 'All',
    source: 'Source',
    sources: { all: 'All sources', aozora: 'Aozora Bunko', user: 'Imported', nhk: 'NHK' },
    topic: 'Topic',
    hideRead: 'Hide finished',
    loading:
      'Loading articles. The first time, the level of each article is estimated; please wait…',
    read: 'Finished',
    chars: '{n} characters',
    levelUnknown: 'Level unknown',
    noArticles: 'No articles match.',
    dropHint: 'You can also drop a .txt file onto this page to import it.',
    removeTitle: 'Delete “{title}”',
    removeBody: 'You can import it again later.',
    back: 'Back to articles',
    backHome: 'Back to Home',
    backCourse: 'Back to the course',
    rubyMode: 'Reading aid',
    ruby: { furigana: 'Furigana', romaji: 'Romaji', none: 'None' },
    underline: 'JLPT underline',
    fontSize: 'Font size',
    smaller: 'Smaller text',
    larger: 'Larger text',
    readAloud: 'Read aloud',
    stop: 'Stop reading',
    noJaVoice: 'No Japanese system voice was found. Please add one in Windows Settings.',
    analyzing: 'Analysing the text…',
    markRead: 'Mark as finished',
    markUnread: 'Mark as not finished',
    original: 'Original source',
    topics: { story: 'Story', poem: 'Poem', folktale: 'Folk tale' },
    bilingual: 'Side-by-side translation',
    translatedChip: 'Translated',
    translation: {
      title: 'Translation of this article',
      hint: 'Paste a translation here, one paragraph per line, in the same order as the paragraphs of the original; any language will do. After saving, click “Side-by-side translation” to show it under each paragraph.',
      save: 'Save translation',
      edit: 'Edit translation',
      remove: 'Delete translation',
      none: 'This article has no translation yet. Click to paste one.'
    },
    practice: 'Article practice',
    excerptNote:
      'This is the public lead of an NHK news story. The full story is on the NHK website and requires signing in to NHK ONE.',
    colophon: 'Source edition and transcription',
    side: { vocab: 'Vocabulary', grammar: 'Grammar' },
    noVocab: 'No words of this text were found in the dictionary.',
    noGrammar: 'No listed grammar points were found in this text.',
    basicGrammar: 'Basic grammar ({n})',
    grammarExplain: 'Explanation and more examples',
    noEntry: 'This word is not in the dictionary.',
    openInDict: 'Open in the dictionary',
    addVocab: 'Add this vocabulary to the notebook',
    nhk: {
      refresh: 'Get NHK news',
      added: 'Got {n} new articles from NHK.',
      openSite: 'Open NHK Easy in the browser',
      openNews: 'Open NHK news in the browser',
      viaNews:
        'NHK News Web Easy now requires signing in to NHK ONE, so this collects the public headlines and leads (the first sentence or two) of NHK news instead. To read a full story, click “Original source” in the article and read it on the NHK website.',
      reasons: {
        off: 'Fetching NHK news is turned off in Settings.',
        auth: 'NHK Easy now requires signing in to NHK ONE and accepting its terms before articles can be seen, so Qonsona cannot fetch them; built-in and imported articles are used instead. You can open NHK Easy in the browser, copy an article and click “Paste an article” to read it here.',
        network: 'NHK could not be reached; built-in and imported articles are used instead.',
        format:
          'The NHK news list has changed format and cannot be read; built-in and imported articles are used instead.'
      }
    },
    qon: {
      intro:
        'Sentences grouped by source, phrases by category, and each document form the texts of this language. Click one to read it.',
      introLessons: 'These are the lessons the author arranged. Click one to read it.',
      kinds: { lesson: 'Lessons', source: 'Sentences', phrases: 'Conversation', doc: 'Documents' },
      ungrouped: 'Other sentences',
      phrases: 'Phrases',
      phrasesOf: 'Phrases · {c}',
      nSentences: '{n} sentences',
      nPhrases: '{n} phrases',
      nWords: '{n} new words',
      empty: 'This language has no sentences, phrases or documents yet.',
      ipa: 'IPA',
      gloss: 'Word-by-word gloss',
      translation: 'Translation',
      newWords: 'New words',
      readFromHere: 'Read aloud from this sentence',
      addNewWords: 'Add these new words to the notebook',
      back: 'Back to texts',
      noLines: 'This text has no sentences or phrases.'
    }
  },
  packs: {
    title: 'Languages',
    intro:
      'These are the languages you can study. Click “Study this language” to switch; the interface colors and modules follow the language.',
    builtin: 'Built in',
    imported: 'Imported from Qonlang',
    current: 'Learning now',
    use: 'Study this language',
    removeTitle: 'Remove “{name}”',
    removeBody:
      'You can import the same Qonlang project again at any time; your recordings are kept.',
    noImported: 'No Qonlang project imported yet.',
    import: 'Import a Qonlang project',
    importHelp:
      'Choose a project file saved by Qonlang (.laim.json), a study pack made with “Export a study pack” in Qonlang’s Settings (.qstudy.json) or a file exported with “Export as one CSV”, or drop the file onto this page. Each language in the project becomes a language you can study.',
    pickLanguages: 'Select the languages to study',
    emptyLanguage: 'No entries, sentences or phrases',
    alreadyImported: 'Already imported; importing again updates it',
    confirmImport: 'Import selected languages',
    importedToast: 'Imported {n} language(s).',
    source: 'Qonlang project “{name}” · {file}',
    engine: 'Read with Qonlang engine {v}',
    study: {
      note: 'This is a study pack exported by “{name}” with Qonlang {version}: its lessons, hidden items, pinned levels, default display and the author’s recordings are imported too.',
      author: 'By {name}',
      lessons: '{n} lessons',
      audio: '{n} author recordings',
      hidden: '{n} hidden'
    },
    reasons: {
      sealed:
        'This is an encrypted view-only copy from Qonlang, which this app does not import. Please ask the author for the original project file (.laim.json).',
      'invalid-json':
        'This file is not valid JSON. Please make sure you chose a Qonlang project file.',
      'not-a-project': 'This file is not a Qonlang project.',
      'newer-schema':
        'This project was saved by a newer Qonlang. The Qonlang engine built into this app is {engine}; please update the app first.',
      'invalid-csv': 'This CSV is not a whole project exported with Qonlang’s “Export as one CSV”.',
      'newer-study-pack':
        'This study pack was exported by a newer version of Qonlang. The built-in Qonlang engine is {engine}; please update Qonsona first.',
      unknown: 'Could not read the file: {detail}'
    }
  },
  courses: {
    intro:
      'Learn in order: each lesson teaches first and then quizzes you, and each unit ends with a test; in the story course you read one text per lesson and pass it with the article practice.',
    none: 'There is nothing to learn here for this language yet.',
    progress: '{passed} of {n} lessons passed',
    testsPassed: '{passed} of {n} unit tests passed',
    start: 'Start',
    continue: 'Continue: {lesson}',
    allLessons: 'All lessons',
    allDone: 'Every lesson is passed. You can retake the unit tests or practise your weak spots.',
    allCourses: 'All courses',
    practice: 'Practise weak spots',
    practiceHint:
      'Quiz yourself again on what you got wrong most often; the score does not count toward the course.',
    noWeak: 'Nothing answered wrong yet.',
    state: { new: 'Not started', learned: 'Studied', passed: 'Passed' },
    best: 'Best {pct}%',
    unitTest: 'Unit test',
    unitTestHint: 'Covers the whole unit; 80% correct to pass.',
    testPassed: 'Passed · best {pct}%',
    legend: 'How forms are written',
    learn: {
      back: 'Back to the course',
      prev: 'Previous',
      next: 'Next',
      startQuiz: 'Start the quiz',
      finish: 'Done',
      itemOf: '{i} of {n}',
      reading: 'Reading',
      ipa: 'IPA',
      pair: { hira: 'Hiragana', kata: 'Katakana' },
      strokes: 'Stroke order',
      examples: 'Example words',
      noExamples: 'No example words were found in the dictionary.',
      readAlong: 'Read along',
      readAlongHint:
        'Words written only with characters you have learned: click the speaker to hear each one, then read it along with its reading.',
      form: 'Form',
      examplesTitle: 'Examples',
      machine: 'Machine translation',
      doc: 'Document',
      base: 'Base form'
    },
    text: {
      read: 'Read it',
      practice: 'Article practice',
      hint: 'After reading in the reader, click “Back to the course” to return here. Getting 80% right in the article practice passes the lesson; you can also click “Done” once you have read it.'
    },
    quiz: {
      title: { lesson: 'Quiz: {lesson}', test: 'Unit test: {unit}', practice: 'Weak spots' },
      progress: 'Question {i} of {n}',
      read: 'Choose its reading',
      write: 'Choose the character read {reading}',
      listen: 'Listen and choose what you hear',
      replay: 'Play again',
      type: 'Type its reading',
      typeHint: 'Press Enter to check',
      check: 'Check',
      word: 'How is this word read?',
      meaning: 'What does the highlighted part mean?',
      fill: 'Choose what fills the blank',
      form: 'Choose its {form}',
      phraseMeaning: 'What does this phrase mean?',
      phrasePick: 'Choose the phrase with this meaning',
      phraseListen: 'Listen and choose the phrase you hear',
      right: 'Correct',
      wrong: 'Not quite: the answer is {answer}',
      next: 'Next',
      finish: 'See results',
      exit: 'End the quiz',
      keys: 'Press 1–4 to choose, Enter for the next question, R to play again, Esc to stop',
      done: { lesson: 'Quiz finished', test: 'Test finished', practice: 'Practice finished' },
      score: '{right} of {n} correct ({pct}%)',
      passed: 'Passed!',
      notPassed: 'You need 80% to pass. Please try again.',
      practiceNote: 'Weak-spot practice does not count toward the course.',
      missed: 'Missed',
      retry: 'Try again',
      nextLesson: 'Next lesson: {lesson}',
      backToCourse: 'Back to the course',
      empty: 'This lesson has no questions to ask, so it has been marked as done.'
    },
    qon: {
      alphabetIntro:
        'Learn the letters and their sounds first, then the scripts of this language; each lesson shows the characters and then quizzes you.',
      letters: 'Letters and sounds',
      lettersNote:
        "Each letter's sound is derived from the language's spelling rules and shown in IPA.",
      scriptNote:
        'The glyphs and their transliterations come from the glyph table in the Qonlang project.',
      docsIntro:
        'The documents the author wrote in Qonlang, one per lesson; click “Done” when you have read one.',
      docsUnit: 'Documents',
      formsIntro:
        "Each word's forms, one unit per paradigm: read the table, then practise picking the right form; the wrong choices are the word's other forms.",
      phrasesIntro:
        'The phrasebook, one category per lesson: listen and read each phrase with its meaning, then practise matching phrases, meanings and sounds.',
      phrasesUnit: 'Phrases',
      uncategorized: 'Other'
    }
  },
  practice: {
    today: 'Today: {n} answered, {right} right',
    level: 'Level',
    count: 'Questions',
    countN: '{n}',
    all: 'All',
    noKinds: 'This language does not have enough words and sentences for practice yet.',
    empty:
      'There is no data for this kind of question at this level. Please choose another level or kind.',
    noVoice: 'This kind needs a system voice.',
    noEntry: 'This entry was not found in the dictionary.',
    progress: 'Question {i} of {n}',
    exit: 'End practice',
    done: 'Set complete',
    score: '{right} of {n} right ({pct}%)',
    again: 'Another set',
    back: 'Back to Practice',
    backArticle: 'Back to the article',
    backCourse: 'Back to the course',
    articleEmpty: 'This article is too short to make questions from.',
    missed: 'Questions you missed',
    right: 'Correct',
    wrong: 'Not quite. The correct answer is marked in green.',
    next: 'Next',
    finish: 'See results',
    replay: 'Play again',
    keys: 'Keys: 1–4 to choose, Enter for next, R to replay, Esc to end',
    review: { right: 'Right', wrong: 'Wrong', blank: 'Unanswered' },
    kinds: {
      mixed: { name: 'Mixed', desc: 'A few of every kind, shuffled.' },
      article: {
        name: 'Article practice',
        desc: 'Questions made from the words, grammar and sentences of one article.'
      },
      'kanji-reading': { name: 'Kanji reading', desc: 'Choose the reading of a kanji word.' },
      orthography: {
        name: 'Kanji spelling',
        desc: 'Choose the right kanji for a word written in kana.'
      },
      'word-meaning': { name: 'Word meaning', desc: 'Choose what a word means.' },
      'meaning-word': { name: 'Meaning to word', desc: 'Choose the word for a meaning.' },
      context: {
        name: 'Fill in the word',
        desc: 'Using the translation, choose the word for the blank.'
      },
      'grammar-fill': {
        name: 'Fill in the grammar',
        desc: 'Using the translation, choose the form for the blank.'
      },
      'grammar-meaning': { name: 'Grammar meaning', desc: 'Choose what the marked grammar means.' },
      conjugate: { name: 'Forms', desc: 'Choose the requested form of a word.' },
      sentence: { name: 'Sentences', desc: 'Read a sentence and choose what it means.' },
      'listen-sentence': {
        name: 'Listening: sentences',
        desc: 'Listen to a sentence and choose what it means.'
      },
      'listen-word': { name: 'Listening: words', desc: 'Listen and choose the word you hear.' },
      'sound-change': {
        name: 'Sound changes',
        desc: 'See an ancestral form and choose what the sound changes made of it in this language.'
      }
    },
    exam: {
      title: 'Mock exams',
      intro:
        'A mock paper laid out like the JLPT: vocabulary, grammar, reading and listening, each with its own time limit. When time runs out you move on to the next section automatically. After you submit, your score is converted the JLPT way (two scored parts for N5 and N4; from N3 on, language knowledge, reading and listening are scored separately) and every question comes with an explanation.',
      paper: '{level} mock exam',
      structure: '{sections} sections · {n} questions · {m} minutes',
      noVoice:
        'No Japanese system voice was found, so the listening questions cannot be played. Please add a Japanese voice in the Windows Speech settings.',
      unavailable: 'Could not create a mock exam: the Japanese dictionary data was not found.',
      history: 'Past exams',
      sectionOf: 'Section {i} of {n}',
      minutes: '{n} min',
      questions: 'Questions',
      listenNote:
        'Listening: the audio plays automatically. Press R or click the speaker to hear it again.',
      prev: 'Previous',
      next: 'Next',
      answered: '{n} of {total} answered',
      nextSection: 'Next section',
      submit: 'Submit',
      blanks:
        '{n} questions in this section are still unanswered, and you cannot change them after moving on. Continue?',
      timeUp: 'Time is up. You are now in the next section.',
      timeUpLast: 'Time is up. Your exam has been submitted.',
      quit: 'Quit the exam',
      quitTitle: 'Quit the exam',
      quitBody: 'If you quit now, this exam will not be scored or saved. Quit anyway?',
      keys: 'Keys: 1–4 to choose, ← → to move between questions, R to replay'
    },
    record: {
      used: 'Took {m} min {s} s',
      passed: 'Pass',
      failed: 'Fail',
      passLine: 'The pass mark is {n}, and each part must also reach its minimum.',
      min: 'Minimum {n}',
      note: 'Each part is scaled to JLPT points from the share of questions you got right. For reference only.',
      explain: 'Explanations',
      onlyWrong: 'Wrong and unanswered ({n})',
      all: 'All ({n})',
      allRight: 'You got every question right.',
      again: 'Take another',
      remove: 'Delete this record',
      removeTitle: 'Delete record',
      removeBody: 'This exam and its score will be deleted for good. Delete it?'
    }
  },
  media: {
    add: 'Add video or audio',
    intro:
      'Play videos and audio from your computer with subtitle files and study them line by line: click any word in a subtitle to look it up, replay a line, loop it, pause after each line, or change the speed. Files stay where they are; the app only remembers their location.',
    empty: 'Your media library is empty. Click "Add video or audio", or drag files here.',
    formats:
      'Video: MP4, WebM, MKV, MOV. Audio: MP3, M4A, WAV, FLAC, OGG. Subtitles: SRT, VTT, ASS / SSA and LRC.',
    dropHint:
      'You can also drag video and audio files into the window. While playing, drag a subtitle file in to add it.',
    dropSubtitleHint: 'Please open a video or audio file first, then drag the subtitle file in.',
    added: 'Added {n} files.',
    subCount: '{n} subtitles',
    noSubtitleShort: 'No subtitles',
    missingShort: 'File not found',
    remove: 'Remove from library',
    removeTitle: 'Remove from library',
    removeBody:
      '"{title}" and its subtitles will be removed from the library. The file on your computer will not be deleted. Remove it?',
    back: 'Library',
    keys: 'Space play, ← → lines, R replay, L loop, P pause after each line',
    missing: 'This file could not be found. It may have been moved or deleted.',
    cannotPlay: 'This file cannot be played: its format or codec is not supported.',
    reveal: 'Show in folder',
    noSubtitles: 'No subtitles yet. Add a subtitle file on the right, or drag one in.',
    peek: 'Show this line',
    seek: 'Position',
    prev: 'Previous line (←)',
    play: 'Play / pause (Space)',
    next: 'Next line (→)',
    repeat: 'Replay this line (R)',
    loop: 'Loop line',
    loopHint: 'Keep repeating the current line (L)',
    autoPause: 'Pause after each line',
    autoPauseHint: 'Pause when each line ends, for shadowing (P)',
    rate: 'Speed',
    subtitle: 'Subtitles',
    showSubsHint:
      'Hide subtitles for listening practice; hover over a line on the right to read it (S)',
    translation: 'Translation',
    mute: 'Mute',
    volume: 'Volume',
    fullscreen: 'Full screen (F)',
    subtitleFailed:
      'Could not read subtitles from {files}. Please make sure they are SRT, VTT, ASS or LRC files.',
    subs: {
      title: 'Subtitles',
      count: '{n} lines',
      settings: 'Subtitle settings',
      primary: 'Main subtitles (the language you are learning)',
      secondary: 'Second subtitles (translation)',
      none: 'Off',
      offset: 'Subtitle timing',
      seconds: '{n} s',
      remove: 'Remove these subtitles',
      removeTitle: 'Remove subtitles',
      removeBody: 'The subtitles "{name}" will be removed. Remove them?',
      empty: 'This item has no subtitles yet.',
      add: 'Add subtitle file',
      hint: 'If the subtitles come too early, click "+0.5" to delay them; if too late, click "−0.5".'
    }
  },
  statsPage: {
    streak: 'Streak',
    days: '{n} days',
    longest: 'Longest: {n} days',
    keepGoing: 'Study a little today to keep it going',
    today: 'Today',
    minutes: '{n} min',
    week: '{n} min in the last 7 days',
    total: 'Total',
    hours: '{n} h',
    studyDays: 'Studied on {n} days',
    words: 'Words studied',
    wordsKnown: '{n} known, {total} in your notebook',
    grammar: 'Grammar points',
    ofTotal: 'of {total}',
    practice: 'Questions answered',
    accuracy: '{pct}% correct',
    noPractice: 'No practice yet',
    last30: 'Study time, last 30 days',
    barTitle: '{day}: {m} min studied, {q} questions, {r} reviews',
    noTime:
      'Study time is recorded from this version on: every 15 seconds while the window is in front and you have used it in the last two minutes.',
    byModule: 'Time by section (last 30 days)',
    courses: 'Course progress',
    notebook: 'Notebook',
    exams: 'Mock exams',
    examBest: 'Best score {n}',
    examTimes: 'Taken {n} times, passed {passed}'
  },
  update: {
    title: 'Version {version} is out!',
    body: 'Download the installer and install it over this version; your notebook, recordings and other study records are kept.',
    bodyAuto:
      'Click “Download and install” to download the new version in the background; when it is done, your notebook is saved and the new version is installed and reopened. Your study records are kept.',
    bodyManual:
      'Click “Download and install” to download the installer in the background; its folder opens when it is done — run the installer to finish. Your study records are kept.',
    manualNext: 'The folder with the installer is open; run the installer to finish updating.',
    download: 'Go to download',
    install: 'Download and install',
    page: 'Release page',
    downloading: 'Downloading {pct}% ({done} / {total} MB)',
    verifying: 'Verifying…',
    installing: 'Installing; the app will reopen shortly…',
    failed: 'Download failed: {err}',
    later: 'Later',
    skip: 'Skip this version'
  },
  settings: {
    title: 'Settings',
    interface: 'Interface',
    locale: 'Interface language',
    theme: 'Light or dark',
    themes: { system: 'Follow system', light: 'Light', dark: 'Dark' },
    data: 'Data',
    dataDir: 'Data folder',
    openDataDir: 'Open data folder',
    about: 'About',
    version: 'Version {v}',
    speech: 'Reading aloud',
    ipaVoice: 'Voice for IPA',
    auto: 'Automatic ({name})',
    noVoice: 'No system voice found',
    rate: 'Speed',
    test: 'Listen',
    speechHelp:
      'Every built-in Windows voice can read IPA; sounds foreign to the voice are approximated. Tone marks cannot be read and are skipped. Your own recordings always take priority.',
    review: 'Review',
    newPerDay: 'New words per day',
    reviewCap: 'Most reviews per day',
    studyOrder: 'Word order',
    orders: { seq: 'New words in the order added', random: 'Shuffled' },
    relearn: 'Ask words answered “Don’t know” again a few cards later',
    reviewHelp:
      'Reviews are picked by due date, most overdue first; “Shuffled” only changes the order they are asked in, never which words are due.',
    reading: 'Reading',
    nhkEasy: 'Fetch NHK news automatically',
    nhkEasyHelp:
      'When on, opening Home or Reading also fetches recent NHK news (at most once an hour) for Reading and the news strip on Home. NHK News Web Easy now requires signing in to NHK ONE, so the public headlines and leads of NHK news are collected instead; click “Original source” to read the full story on the NHK website. If fetching fails, built-in and imported articles are used and the reason is shown.',
    engine: 'Qonlang engine: {v} ({date})',
    checkUpdates: 'Check for new versions automatically',
    updateCheckMinutes: 'Check for new versions every (minutes)',
    checkNow: 'Check for updates now',
    latestVersion: 'Latest version {v}',
    latestUnknown: 'Latest version not checked yet',
    updateChecking: 'Checking…',
    updateLatest: 'You have the latest version (v{v})',
    updateNewer: 'Version {v} is available; download it from the notice at the bottom right',
    updateFailed: {
      offline:
        'Check failed: GitHub cannot be reached. Please check your network or proxy and try again later',
      rateLimited: 'Check failed: GitHub has run out of queries for now. Please try again later',
      notFound: 'Check failed: the release page was not found'
    },
    backup: {
      title: 'Backup',
      export: 'Export backup',
      restore: 'Restore from backup',
      help: 'A backup is one zip file with your course progress, notebook, practice records, study time, imported languages and articles, your recordings, and your media library and subtitles. Video and audio files themselves are not included. When you restore, your current data is first moved to a "backup-before-restore" folder in the data directory, and then the app restarts.',
      exported: 'Exported {n} files ({size} MB) to {path}',
      restoreTitle: 'Restore from backup',
      restoreBody:
        'This backup was made on {date} and contains {n} files. Restoring replaces your current data; the current data is kept in a "backup-before-restore" folder in the data directory. The app will restart. Restore now?',
      restoreOk: 'Restore and restart',
      restored:
        'Restored {n} files from the backup. Your previous data is kept in the "backup-before-restore" folder in the data directory.',
      restoreFailed: 'The backup could not be restored. You are still using your previous data.',
      bad: {
        unreadable: 'This file could not be read. Please make sure it is a complete zip file.',
        'not-backup': 'This is not a Qonsona backup.',
        newer: 'This backup comes from a newer version of Qonsona. Please update the app first.'
      }
    },
    sources: 'Data sources and licenses',
    sourcesNote:
      'The built-in Japanese data comes from the open data sets below and is used under their licenses; modified data is offered under the same licenses.'
  }
}
