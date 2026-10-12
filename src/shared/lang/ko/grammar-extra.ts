import type { LexGrammarPoint } from '../types'

// 每行两句自写例句及明确连续高亮；依教学难度分级，非官方 TOPIK 出题清单。
const rows = `
1|also|도 也|Also|附着名词表达也；常替换主宾助词。|Adds also to a noun and often replaces subject or object particles.|저도 학생이에요.|我也是学生。|I am a student too.|저도|친구도 왔어요.|朋友也来了。|My friend came too.|친구도
1|with|하고 一起与列举|And / with|名词后 하고 可列举或表示伴随。|하고 after a noun coordinates nouns or expresses accompaniment.|친구하고 갔어요.|我和朋友去了。|I went with a friend.|친구하고|빵하고 우유를 샀어요.|我买了面包和牛奶。|I bought bread and milk.|빵하고 우유를
1|negative|안 短否定|Short negation|안 否定动作或状态；不能表示因能力不足而不能。|안 negates an action or state, rather than inability.|오늘 안 가요.|我今天不去。|I am not going today.|안 가요|이 음식은 안 매워요.|这道菜不辣。|This food is not spicy.|안 매워요
1|exist|있다/없다 存在|Existence|名词 이/가 있다/없다 表示存在或所有。|Noun + 이/가 있다/없다 expresses existence or possession.|책이 있어요.|有一本书。|There is a book.|책이 있어요|시간이 없어요.|没有时间。|There is no time.|시간이 없어요
2|fromto|부터/까지 起止|From / until|부터 和 까지 标明时间或范围的起止。|부터 and 까지 mark the start and end of a time or range.|아홉 시부터 일해요.|我从九点开始工作。|I work from nine.|아홉 시부터|다섯 시까지 기다려요.|我等到五点。|I wait until five.|다섯 시까지
2|recipient|에게/한테 对人|Human recipient|에게 较书面，한테 常用于口语；尊敬对象用 께。|에게 is more formal and 한테 conversational; 께 honors the recipient.|친구에게 편지를 썼어요.|我给朋友写了信。|I wrote a letter to a friend.|친구에게|동생한테 선물을 줬어요.|我给弟弟礼物了。|I gave my younger brother a gift.|동생한테
2|progressive|고 있다 进行|Progressive|表示动作正在进行；穿戴类动词可表示结果状态。|Expresses an ongoing action; with wearing verbs it can express a resultant state.|책을 읽고 있어요.|我正在读书。|I am reading a book.|읽고 있어요|지금 공부하고 있어요.|我现在正在学习。|I am studying now.|공부하고 있어요
2|inability|못/지 못하다|Inability|客观不能或能力不足；区别主观不做的 안。|Marks inability or prevention, unlike voluntary non-action with 안.|수영을 못 해요.|我不会游泳。|I cannot swim.|못 해요|오늘 가지 못해요.|我今天去不了。|I cannot go today.|가지 못해요
2|contrastbut|지만 转折|But|直接连接相反或不同的两项。|Connects two contrasting propositions.|작지만 편해요.|虽然小，但很舒服。|It is small but comfortable.|작지만|비싸지만 맛있어요.|虽然贵，但很好吃。|It is expensive but delicious.|비싸지만
2|purposemotion|(으)러 目的移动|Purpose of motion|接移动动词；不是任意动作的目的连接词。|Occurs with motion verbs, not any arbitrary purpose clause.|밥을 먹으러 갔어요.|我去吃饭了。|I went to eat.|먹으러|친구를 만나러 왔어요.|我来见朋友。|I came to meet a friend.|만나러
3|becausecommand|(으)니까 理由|Reason for request|常给命令或建议提供理由，可接过去时。|Can justify a command or suggestion and can follow past tense.|추우니까 창문을 닫으세요.|因为冷，请关窗。|It is cold, so close the window.|추우니까|늦었으니까 택시를 타요.|已经晚了，我们坐出租车吧。|It is late, so let us take a taxi.|늦었으니까
3|before|기 전에|Before doing|动词词干 + 기 전에；前面的动作不加过去时。|Verb stem + 기 전에; the earlier action does not take a past marker.|먹기 전에 손을 씻어요.|饭前洗手。|I wash my hands before eating.|먹기 전에|자기 전에 책을 읽어요.|我睡前读书。|I read before sleeping.|자기 전에
3|after|(으)ㄴ 후에|After doing|动作完成的定语形 + 후에。|Uses a completed-action adnominal form followed by 후에.|밥을 먹은 후에 나갔어요.|我吃饭后出去了。|I went out after eating.|먹은 후에|수업이 끝난 후에 만나요.|下课后见吧。|Let us meet after class ends.|끝난 후에
3|intention|(으)려고|Intention / purpose|接动作词干表达目的；主体通常一致。|Expresses intended purpose after action verbs, usually with the same subject.|한국어를 배우려고 왔어요.|我是来学韩语的。|I came to learn Korean.|배우려고|책을 사려고 서점에 갔어요.|我为买书去了书店。|I went to the bookshop to buy a book.|사려고
3|questionquote|냐고 하다|Reported question|引用问句；具体接续随时态、词性而变。|Reports a question; the ending depends on tense and predicate type.|친구가 어디 가냐고 물었어요.|朋友问我要去哪里。|My friend asked where I was going.|가냐고 물었어요|언제 오냐고 물었어요.|我问他什么时候来。|I asked when he was coming.|오냐고 물었어요
4|commandquote|(으)라고 하다|Reported command|引用指令；请求句常用 달라고/주라고 区分受益者。|Reports a command; requests distinguish 달라고 and 주라고 by beneficiary.|선생님이 읽으라고 했어요.|老师让我们读。|The teacher told us to read.|읽으라고 했어요|친구가 기다리라고 했어요.|朋友让我等。|My friend told me to wait.|기다리라고 했어요
4|suggestquote|자고 하다|Reported suggestion|引用共同做某事的提议。|Reports a proposal to act together.|친구가 같이 가자고 했어요.|朋友提议一起去。|My friend suggested going together.|가자고 했어요|형이 쉬자고 했어요.|哥哥提议休息。|My older brother suggested resting.|쉬자고 했어요
4|resultstate|아/어 있다|Resultant state|表示变化完成后的持续状态；通常接不及物动词。|Expresses a continuing resultant state, usually with intransitive verbs.|문이 열려 있어요.|门开着。|The door is open.|열려 있어요|학생들이 앉아 있어요.|学生们坐着。|The students are seated.|앉아 있어요
4|while|(으)면서|While doing|同一主体同时动作，通常不用前项过去时。|Links simultaneous actions by the same subject without past marking on the first verb.|음악을 들으면서 걸어요.|我边听音乐边走。|I walk while listening to music.|들으면서|밥을 먹으면서 이야기했어요.|我们边吃饭边聊天。|We talked while eating.|먹으면서
4|nominalum|(으)ㅁ 名词化|Formal nominalization|书面记录或抽象名词化；与 기 的选择依用法。|Used in records and abstract nominalization; its distribution differs from 기.|회의가 끝났음을 알렸어요.|我宣布会议结束了。|I announced that the meeting had ended.|끝났음을|그 사실을 알고 있음이 드러났어요.|可以看出他知道那个事实。|It emerged that he knew that fact.|알고 있음이
5|habit|곤 하다|Habitual action|过去 반복 常用 곤 했다；不是表示单次完成。|Marks habitual actions, often past with 곤 했다, not a single completion.|어릴 때 여기서 놀곤 했어요.|小时候我常在这里玩。|I used to play here as a child.|놀곤 했어요|주말에 산에 가곤 해요.|我周末常去山里。|I often go to the mountains on weekends.|가곤 해요
5|observation|더라고요|Recalled observation|讲述亲历或观察的新发现，避免当作无来源事实。|Reports a recalled firsthand observation or discovery.|그 식당 음식이 맛있더라고요.|我发现那家店的饭很好吃。|I found that the food there was delicious.|맛있더라고요|사람이 많더라고요.|我发现人很多。|I found there were many people.|많더라고요
5|negativeeval|는 바람에|Unexpected adverse cause|多指非预期原因造成的负面结果。|Usually gives an unexpected cause of an adverse result.|버스를 놓치는 바람에 늦었어요.|因为错过公交，我迟到了。|I was late because I missed the bus.|놓치는 바람에|비가 오는 바람에 경기가 취소됐어요.|因下雨，比赛取消了。|The game was cancelled because it rained.|오는 바람에
5|causeaction|느라고|Absorbing cause|前项动作导致后项不利结果，通常同主体。|An absorbing action causes an adverse result, usually for the same subject.|일하느라고 전화를 못 받았어요.|忙着工作，没接到电话。|I could not answer because I was working.|일하느라고|공부하느라고 잠을 못 잤어요.|忙着学习，没能睡觉。|I could not sleep because I was studying.|공부하느라고
5|moreandmore|(으)ㄹ수록|The more ...|程度随前项增加，表达递增关系。|Expresses an increasing relationship as the first action progresses.|읽을수록 재미있어요.|越读越有趣。|The more I read, the more interesting it is.|읽을수록|알수록 어려워요.|越了解越觉得难。|The more I know, the harder it seems.|알수록
6|expected|(으)ㄴ/는 셈이다|Effectively amounts to|对结果进行概括判断，不等于直接断言。|Summarizes what a result effectively amounts to.|거의 끝난 셈이에요.|算是差不多结束了。|It is effectively almost finished.|끝난 셈이에요|매일 연습하는 셈이에요.|这等于每天练习。|It amounts to practicing every day.|연습하는 셈이에요
6|notonly|뿐만 아니라|Not only ...|在前项以外补充后项，接续按名词或谓词变化。|Adds another proposition; attachment differs for nouns and predicates.|편리할 뿐만 아니라 저렴해요.|不仅方便，还便宜。|It is not only convenient but also inexpensive.|편리할 뿐만 아니라|학생뿐만 아니라 선생님도 왔어요.|不仅学生，老师也来了。|Not only students but also teachers came.|학생뿐만 아니라
6|worthy|(으)ㄹ 만하다|Worth / reasonably possible|按语境表示值得或程度还可以。|Depending on context, means worthwhile or reasonably possible.|이 책은 읽을 만해요.|这本书值得一读。|This book is worth reading.|읽을 만해요|아직 먹을 만해요.|还可以吃。|It is still good enough to eat.|먹을 만해요
6|stipulated|에 한하여|Limited to|书面语把适用范围限定为某类对象。|Restricts the scope to a specified class in formal writing.|회원에 한하여 입장할 수 있습니다.|仅会员可以入场。|Admission is limited to members.|회원에 한하여|오늘에 한하여 무료입니다.|仅今天免费。|It is free today only.|오늘에 한하여
6|alternativeless|기는 하지만|Qualified concession|承认前项但对结论加限制，语气依上下文。|Concedes a proposition while qualifying the conclusion.|좋기는 하지만 너무 비싸요.|虽好，但太贵了。|It is good, but too expensive.|좋기는 하지만|알기는 하지만 설명하기 어려워요.|我虽知道，但难以解释。|I know it, but it is hard to explain.|알기는 하지만
`
  .trim()
  .split('\n')
  .map((row) => row.split('|'))
export const extraGrammar: LexGrammarPoint[] = rows.map(
  ([level, id, zh, en, mz, me, text, tz, te, hl, text2, tz2, te2, hl2]) => ({
    id: `ko-${id}`,
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
