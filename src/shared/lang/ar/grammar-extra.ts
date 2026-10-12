import type { LexGrammarPoint } from '../types'
const rows = `
A1|pronouns|独立人称代词|Independent pronouns|独立代词可作名词句主语，性数有区别。|Independent pronouns can be nominal subjects and distinguish gender and number.|أنا طالب.|我是男学生。|I am a male student.|أنا|هي طبيبة.|她是医生。|She is a doctor.|هي
A1|questions|هل 与疑问词|Questions|هل 问是否，أين 问地点，من 问人。|هل asks yes/no questions, أين location, and من people.|هل أنت طالب؟|你是学生吗？|Are you a student?|هل|أين المدرسة؟|学校在哪里？|Where is the school?|أين
A1|demonstrative|هذا/هذه 指示|Demonstratives|近指 هذا 阳性、هذه 阴性，注意指示词与后面的定指。|هذا is masculine near deixis and هذه feminine; definiteness changes sentence structure.|هذا البيت كبير.|这座房子很大。|This house is large.|هذا البيت|هذه السيارة جديدة.|这辆车是新的。|This car is new.|هذه السيارة
A1|feminine|ة 与阴性|Feminine ending|ة 常标阴性但非所有阴性名词都有此词尾。|ة commonly marks feminine nouns, but many feminine nouns lack it.|هذه طالبة.|这是女学生。|This is a female student.|طالبة|أختي معلمة.|我姐姐是老师。|My sister is a teacher.|معلمة
A1|coordination|و 和|Coordination|و 附着后词，连接并列成分，不假设时间先后。|و attaches to the following word and coordinates without necessarily ordering events.|عندي كتاب وقلم.|我有书和笔。|I have a book and a pen.|وقلم|جاء أحمد ومريم.|艾哈迈德和玛丽亚姆来了。|Ahmed and Maryam came.|ومريم
A2|subjectverb|动词前后主语配合|Subject and verb order|主语先行时动词数配合；动词先行接复数显式主语常用单数。|A preceding subject triggers number agreement; a preceding verb before an overt plural subject normally stays singular.|الطلاب يقرؤون.|学生们在读书。|The students are reading.|الطلاب يقرؤون|يقرأ الطلاب.|学生们在读书。|The students are reading.|يقرأ الطلاب
A2|imperative|命令式|Imperative|命令式按第二人称性数变化；开头辅音群常需 وصل。|Imperatives vary by addressee gender and number and may require hamzat al-waṣl.|اكتب اسمك.|写下你的名字（对男性）。|Write your name, to a male.|اكتب|اكتبي اسمك.|写下你的名字（对女性）。|Write your name, to a female.|اكتبي
A2|dual|双数|Dual|主格 ـان，宾属格 ـين；正偏组合中 ن 脱落。|Dual nominative ends in ـان, oblique in ـين; nūn drops in iḍāfa.|عندي كتابان.|我有两本书。|I have two books.|كتابان|قرأت كتابين.|我读了两本书。|I read two books.|كتابين
A2|soundplural|规则复数|Sound plurals|阳性规则复数主格 ون，斜格 ين；阴性规则复数 ات。|Sound masculine plurals take ون nominative and ين oblique; feminine plurals take ات.|المعلمون هنا.|男老师们在这里。|The male teachers are here.|المعلمون|المعلمات هنا.|女老师们在这里。|The female teachers are here.|المعلمات
A2|brokenplural|破碎复数|Broken plurals|复数可变内部结构，须随词学习，不把所有名词加 ات。|Broken plurals change internal structure and must be learned lexically.|هذه كتب.|这些是书。|These are books.|كتب|الأطفال في المدرسة.|孩子们在学校。|The children are at school.|الأطفال
B1|formii|第二式 فعّل|Form II|第二式常有使役或强化含义，具体词义不能只靠模式推断。|Form II often has causative or intensive meaning, but lexical meaning must be checked.|علّم الأستاذ الطلاب.|老师教了学生。|The teacher taught the students.|علّم|نظّفت الغرفة.|我清扫了房间。|I cleaned the room.|نظّفت
B1|formiii|第三式 فاعل|Form III|第三式常有与人互动含义，但并非固定互相。|Form III often involves another participant, without always being reciprocal.|ساعدت صديقي.|我帮助了朋友。|I helped my friend.|ساعدت|ناقشنا المشكلة.|我们讨论了问题。|We discussed the problem.|ناقشنا
B1|formiv|第四式 أفعل|Form IV|第四式常为使役；过去式词首 hamza 为 قطع。|Form IV is often causative; its past initial hamza is hamzat al-qaṭʿ.|أرسلت رسالة.|我寄了一封信。|I sent a letter.|أرسلت|أعلن المدير القرار.|经理宣布了决定。|The manager announced the decision.|أعلن
B1|formv|第五式 تفعّل|Form V|常与第二式相关，表示反身或取得状态；按词核实。|Often related to Form II with reflexive or acquired-state meanings; verify lexically.|تعلمت العربية.|我学了阿拉伯语。|I learned Arabic.|تعلمت|تذكرت اسمه.|我想起了他的名字。|I remembered his name.|تذكرت
B1|formx|第十式 استفعل|Form X|第十式常与寻求、认为相关，但并非全都如此。|Form X often relates to seeking or considering, but not universally.|استخدمت الحاسوب.|我用了电脑。|I used the computer.|استخدمت|استقبلنا الضيوف.|我们接待了客人。|We welcomed the guests.|استقبلنا
B2|formvi|第六式 تفاعل|Form VI|常表相互作用；并非每个动词都保持这层意义。|Often expresses reciprocity, though not every verb retains it.|تعاون الطلاب.|学生们合作了。|The students cooperated.|تعاون|تبادلنا الرسائل.|我们交换了信件。|We exchanged letters.|تبادلنا
B2|formvii|第七式 انفعل|Form VII|常表示非及物的变化或受动，与语法被动区别。|Often marks an intransitive change or affected subject, distinct from grammatical passive.|انكسر الزجاج.|玻璃碎了。|The glass broke.|انكسر|انفتح الباب.|门打开了。|The door opened.|انفتح
B2|formviii|第八式 افتعل|Form VIII|模式中的 ت 可能同化；具体意义随词而异。|The pattern’s ت may assimilate; meanings vary lexically.|اجتمع الأصدقاء.|朋友们聚在一起。|The friends gathered.|اجتمع|اقترب القطار.|火车靠近了。|The train approached.|اقترب
B2|formix|第九式 افعلّ|Form IX|通常表达颜色或身体状态，末根辅音叠写。|Usually expresses colours or bodily conditions with final-root gemination.|احمرّ وجهه.|他的脸红了。|His face reddened.|احمرّ|اصفرّت الأوراق.|叶子变黄了。|The leaves turned yellow.|اصفرّت
B2|activeparticiple|主动分词|Active participle|可作形容词或名词，词义、时间解释依语境。|May function as an adjective or noun; temporal interpretation depends on context.|الطالب جالس.|学生坐着。|The student is seated.|جالس|هو كاتب معروف.|他是知名作家。|He is a well-known writer.|كاتب
C1|passiveparticiple|被动分词|Passive participle|表达受动或结果状态，派生式的模式与一式不同。|Expresses an affected or resultant state; derived forms use different patterns from Form I.|الباب مفتوح.|门开着。|The door is open.|مفتوح|القرار مكتوب.|决定写下来了。|The decision is written.|مكتوب
C1|weakhollow|中弱根动词|Hollow verbs|中根弱字母变化依词形，例如 قال/قلت；不可照强根套用。|A weak middle radical changes across forms, e.g. قال/قلت, unlike strong-root verbs.|قال الحقيقة.|他说了真相。|He told the truth.|قال|قلت الحقيقة.|我说了真相。|I told the truth.|قلت
C1|weakdefective|末弱根动词|Defective verbs|末根弱字母可在切格或后缀前变化。|A weak final radical may change in the jussive or before suffixes.|دعا الطبيب.|他叫来了医生。|He called the doctor.|دعا|لم يدع الطبيب.|他没有叫医生。|He did not call the doctor.|لم يدع
C1|doubled|叠根动词|Doubled verbs|第二三根相同，在带辅音后缀形式中可拆开。|Identical second and third radicals may separate before consonantal suffixes.|مدّ يده.|他伸出了手。|He stretched out his hand.|مدّ|مددت يدي.|我伸出了手。|I stretched out my hand.|مددت
C1|fives|五动词形式语气|Five verb forms and mood|双数、阳性复数、阴性第二单数未完成式在虚拟/切格中脱落 ن。|Dual, masculine plural and feminine 2sg imperfect forms lose nūn in subjunctive and jussive moods.|لن يكتبوا الرسالة.|他们不会写信。|They will not write the letter.|لن يكتبوا|لم يكتبوا الرسالة.|他们没有写信。|They did not write the letter.|لم يكتبوا
C2|prohibition|لا الناهية 禁止|Prohibitive lā|禁止用 لا + 第二人称切格，与陈述否定 لا 区分。|Prohibition uses لا with second-person jussive, unlike declarative negation.|لا تكتبْ هنا.|不要在这里写。|Do not write here.|لا تكتبْ|لا تتأخرْ.|不要迟到。|Do not be late.|لا تتأخرْ
C2|lamcommand|命令 لام|Jussive lām of command|لِـ 接未完成式切格用于第三或第一人称要求。|لِـ with a jussive imperfect conveys a third- or first-person directive.|ليكتبْ كل طالب اسمه.|让每个学生写下名字。|Let each student write their name.|ليكتبْ|لنبدأْ العمل.|让我们开始工作。|Let us begin work.|لنبدأْ
C2|apposition|同位语 بدل|Apposition|同位语随被说明项的格，不能凭位置判断主语。|An apposition shares the case of its referent; position alone does not determine the subject.|جاء أخي أحمد.|我哥哥艾哈迈德来了。|My brother Ahmed came.|أخي أحمد|رأيت أخي أحمد.|我见到了哥哥艾哈迈德。|I saw my brother Ahmed.|أخي أحمد
C2|causalaccusative|原因宾格|Accusative of purpose|原因动名词可用宾格解释动作动机，须满足相应语义句法条件。|An accusative verbal noun can express motive, subject to semantic and syntactic constraints.|سافرت طلبا للعلم.|我为求学而出行。|I travelled in pursuit of knowledge.|طلبا للعلم|وقفت احتراما للمعلم.|我为尊重老师而站起来。|I stood out of respect for the teacher.|احتراما للمعلم
C2|lawla|لولا 非现实条件|Lawlā counterfactual|لولا + 名词表示若非某事，肯定结果常用 لَـ。|لولا with a noun means were it not for; an affirmative result often takes لَـ.|لولا المطر لخرجنا.|若不是下雨，我们就出去了。|Were it not for the rain, we would have gone out.|لولا المطر لخرجنا|لولا مساعدتك لفشلنا.|若没有你的帮助，我们就失败了。|Without your help, we would have failed.|لولا مساعدتك لفشلنا
`
  .trim()
  .split('\n')
  .map((row) => row.split('|'))
export const extraGrammar: LexGrammarPoint[] = rows.map(
  ([level, id, zh, en, mz, me, text, tz, te, hl, text2, tz2, te2, hl2]) => ({
    id: `ar-${id}`,
    level,
    name: { zh, en },
    form: { zh, en },
    meaning: { zh: mz, en: me },
    examples: [
      { text, zh: tz, en: te, hl },
      { text: text2, zh: tz2, en: te2, hl: hl2 }
    ]
  })
)
