// 千语集 1.0.0-beta.1（41e5354）的 src/renderer/src/lib/i18n/en.ts（只取 morphemes.types、lexicon.etyTypes、script.types），由 scripts/sync-qonlang.mjs 同步，别手改。
export default {
  "morphemes": {
    "types": {
      "root": "root",
      "prefix": "prefix",
      "suffix": "suffix",
      "infix": "infix",
      "circumfix": "circumfix",
      "clitic": "clitic",
      "pattern": "pattern",
      "particle": "particle"
    }
  },
  "lexicon": {
    "etyTypes": {
      "root": "root",
      "compound": "compound",
      "derivation": "derivation",
      "soundChange": "sound change",
      "borrowing": "borrowing",
      "inherited": "inherited",
      "unknown": "unknown"
    }
  },
  "script": {
    "types": {
      "alphabet": "Alphabet",
      "abjad": "Abjad",
      "abugida": "Abugida",
      "syllabary": "Syllabary",
      "logographic": "Logographic",
      "featural": "Featural",
      "mixed": "Mixed",
      "other": "Other"
    }
  }
} as const
