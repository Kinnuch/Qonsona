/**
 * 日语的会话课：日常最常用的短语，按场合分课（问候、道谢道歉、吃饭、购物、问路、求助、自我介绍、附和）。
 * 每句带假名读音与中英意思，朗读用系统日语语音。短语是手写的。
 */
import type { Course, CourseLesson, CourseUnit, PhraseItem, Text } from '../course'

/** 写法 | 读音 | 中文 | 英文 | 说明（可空） */
type Row = [string, string, string, string, string?, string?]

interface LessonSpec {
  id: string
  title: Text
  rows: Row[]
}

interface UnitSpec {
  id: string
  title: Text
  lessons: LessonSpec[]
}

const UNITS: UnitSpec[] = [
  {
    id: 'greet',
    title: { zh: '问候与礼貌', en: 'Greetings and courtesy' },
    lessons: [
      {
        id: 'greetings',
        title: { zh: '问候', en: 'Greetings' },
        rows: [
          ['おはようございます', 'おはようございます', '早上好', 'Good morning'],
          ['こんにちは', 'こんにちは', '你好（白天用）', 'Hello (during the day)'],
          ['こんばんは', 'こんばんは', '晚上好', 'Good evening'],
          ['おやすみなさい', 'おやすみなさい', '晚安', 'Good night'],
          ['さようなら', 'さようなら', '再见', 'Goodbye'],
          ['はじめまして', 'はじめまして', '初次见面', 'Nice to meet you'],
          [
            'よろしくお願いします',
            'よろしくおねがいします',
            '请多关照',
            'I look forward to getting to know you'
          ]
        ]
      },
      {
        id: 'thanks',
        title: { zh: '道谢与道歉', en: 'Thanks and apologies' },
        rows: [
          ['ありがとうございます', 'ありがとうございます', '谢谢', 'Thank you'],
          ['どういたしまして', 'どういたしまして', '不客气', "You're welcome"],
          ['すみません', 'すみません', '对不起；劳驾', "Excuse me; I'm sorry"],
          ['ごめんなさい', 'ごめんなさい', '对不起', "I'm sorry"],
          ['大丈夫です', 'だいじょうぶです', '没关系；没事', "It's all right"],
          [
            '失礼します',
            'しつれいします',
            '打扰了',
            'Excuse me',
            '进出别人的房间、办公室时说。',
            'Said when entering or leaving someone’s room or office.'
          ]
        ]
      }
    ]
  },
  {
    id: 'daily',
    title: { zh: '吃饭与购物', en: 'Eating and shopping' },
    lessons: [
      {
        id: 'meals',
        title: { zh: '吃饭', en: 'Meals' },
        rows: [
          [
            'いただきます',
            'いただきます',
            '我开动了',
            "Let's eat",
            '吃饭前说。',
            'Said before eating.'
          ],
          [
            'ごちそうさまでした',
            'ごちそうさまでした',
            '谢谢款待；我吃好了',
            'Thank you for the meal',
            '吃完饭说。',
            'Said after eating.'
          ],
          ['おいしいです', 'おいしいです', '很好吃', "It's delicious"],
          ['これをください', 'これをください', '请给我这个', 'This one, please'],
          ['お水をください', 'おみずをください', '请给我一杯水', 'Some water, please'],
          ['お会計をお願いします', 'おかいけいをおねがいします', '请结账', 'The bill, please']
        ]
      },
      {
        id: 'shopping',
        title: { zh: '购物', en: 'Shopping' },
        rows: [
          ['いくらですか', 'いくらですか', '多少钱？', 'How much is it?'],
          ['これは何ですか', 'これはなんですか', '这是什么？', 'What is this?'],
          ['見てもいいですか', 'みてもいいですか', '可以看看吗？', 'May I have a look?'],
          ['カードで払えますか', 'カードではらえますか', '可以刷卡吗？', 'Can I pay by card?'],
          ['袋はいりません', 'ふくろはいりません', '不需要袋子', "I don't need a bag"],
          ['また来ます', 'またきます', '我下次再来', "I'll come again"]
        ]
      }
    ]
  },
  {
    id: 'out',
    title: { zh: '出门在外', en: 'Out and about' },
    lessons: [
      {
        id: 'way',
        title: { zh: '问路', en: 'Asking the way' },
        rows: [
          ['駅はどこですか', 'えきはどこですか', '车站在哪里？', 'Where is the station?'],
          ['トイレはどこですか', 'トイレはどこですか', '厕所在哪里？', 'Where is the restroom?'],
          [
            'まっすぐ行ってください',
            'まっすぐいってください',
            '请一直往前走',
            'Please go straight ahead'
          ],
          ['右に曲がってください', 'みぎにまがってください', '请向右拐', 'Please turn right'],
          ['遠いですか', 'とおいですか', '远吗？', 'Is it far?'],
          ['歩いて行けますか', 'あるいていけますか', '走得过去吗？', 'Can I walk there?']
        ]
      },
      {
        id: 'trouble',
        title: { zh: '遇到困难', en: 'When in trouble' },
        rows: [
          ['もう一度お願いします', 'もういちどおねがいします', '请再说一遍', 'Once more, please'],
          [
            'ゆっくり話してください',
            'ゆっくりはなしてください',
            '请说慢一点',
            'Please speak slowly'
          ],
          ['分かりません', 'わかりません', '我不明白', "I don't understand"],
          ['英語を話せますか', 'えいごをはなせますか', '你会说英语吗？', 'Do you speak English?'],
          ['助けてください', 'たすけてください', '请帮帮我', 'Please help me'],
          ['道に迷いました', 'みちにまよいました', '我迷路了', "I'm lost"]
        ]
      }
    ]
  },
  {
    id: 'chat',
    title: { zh: '聊天', en: 'Small talk' },
    lessons: [
      {
        id: 'intro',
        title: { zh: '自我介绍', en: 'Introducing yourself' },
        rows: [
          ['私は学生です', 'わたしはがくせいです', '我是学生', "I'm a student"],
          ['中国から来ました', 'ちゅうごくからきました', '我从中国来', "I'm from China"],
          [
            '日本語を勉強しています',
            'にほんごをべんきょうしています',
            '我在学日语',
            "I'm studying Japanese"
          ],
          ['趣味は読書です', 'しゅみはどくしょです', '我的爱好是读书', 'My hobby is reading'],
          ['東京に住んでいます', 'とうきょうにすんでいます', '我住在东京', 'I live in Tokyo'],
          [
            'よろしくね',
            'よろしくね',
            '多关照啊',
            'Nice to meet you',
            '对朋友、晚辈说的随便说法。',
            'A casual form for friends and people younger than you.'
          ]
        ]
      },
      {
        id: 'aizuchi',
        title: { zh: '附和与回应', en: 'Responses' },
        rows: [
          ['そうですね', 'そうですね', '是啊；嗯……（想一想）', "That's right; let me see"],
          ['なるほど', 'なるほど', '原来如此', 'I see'],
          ['本当ですか', 'ほんとうですか', '真的吗？', 'Really?'],
          ['いいですね', 'いいですね', '不错啊', 'That sounds good'],
          ['ちょっと待ってください', 'ちょっとまってください', '请稍等', 'Just a moment, please'],
          ['大丈夫ですか', 'だいじょうぶですか', '你没事吧？', 'Are you all right?']
        ]
      }
    ]
  }
]

/** 会话这门课 */
export function jaPhrasesCourse(): Course {
  const phrases: Record<string, PhraseItem> = {}
  const units: CourseUnit[] = UNITS.map((u) => ({
    id: u.id,
    title: u.title,
    test: true,
    lessons: u.lessons.map((l): CourseLesson => {
      const items = l.rows.map(([text, reading, zh, en, noteZh, noteEn], i) => {
        const key = `${u.id}-${l.id}-${i + 1}`
        phrases[key] = {
          key,
          text,
          ...(reading !== text && { reading }),
          meaning: { zh, en },
          say: { text: reading, lang: 'ja-JP' },
          ...(noteZh && { note: { zh: noteZh, en: noteEn ?? noteZh } })
        }
        return key
      })
      return { id: `${u.id}-${l.id}`, title: l.title, items }
    })
  }))
  return {
    id: 'phrasebook',
    kind: 'phrases',
    title: { zh: '会话', en: 'Phrases' },
    intro: {
      zh: '日常最常用的短语，按场合分课：先听、看读音和意思，再做看短语选意思、看意思选短语、听音选短语的练习。',
      en: 'The most common everyday phrases, one situation per lesson: listen and read them with their meanings, then practise matching phrases, meanings and sounds.'
    },
    units,
    symbols: {},
    grammar: {},
    docs: {},
    phrases
  }
}
