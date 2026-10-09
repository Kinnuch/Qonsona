// 千语集 1.0.0-beta.1（41e5354）的 src/renderer/src/lib/i18n/zh.ts（只取 morphemes.types、lexicon.etyTypes、script.types），由 scripts/sync-qonlang.mjs 同步，别手改。
export default {
  "morphemes": {
    "types": {
      "root": "词根",
      "prefix": "前缀",
      "suffix": "后缀",
      "infix": "中缀",
      "circumfix": "环缀",
      "clitic": "附着词",
      "pattern": "模板",
      "particle": "小品词"
    }
  },
  "lexicon": {
    "etyTypes": {
      "root": "词根",
      "compound": "复合",
      "derivation": "派生",
      "soundChange": "音变",
      "borrowing": "借词",
      "inherited": "继承",
      "unknown": "未知"
    }
  },
  "script": {
    "types": {
      "alphabet": "全音素文字（alphabet）",
      "abjad": "辅音音素文字（abjad）",
      "abugida": "元音附标文字（abugida）",
      "syllabary": "音节文字（syllabary）",
      "logographic": "语素文字（logographic）",
      "featural": "特征文字（featural）",
      "mixed": "混合",
      "other": "其他"
    }
  }
} as const
