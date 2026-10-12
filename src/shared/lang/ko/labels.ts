/**
 * 韩语的标签、类别、特有字段在界面上怎么叫（LangModule.labels：界面先查这门语言的，再查通用的）。
 * 键直接写标签：词尾、助词的词典式写法（-아요/어요、은/는），活用类别（ㅂ 불규칙），x 字段写 'x.<键名>'。
 * 说明写「叫法：作用」，一句话；举例尽量用初级词。
 */
import type { LocalizedText } from '../types'

const L = (zh: string, en: string): LocalizedText => ({ zh, en })

/** 先语末词尾、语末词尾（标签与 endings.ts 的 label 一致） */
const ENDINGS: Record<string, LocalizedText> = {
  '-(으)시-': L('-(으)시-：尊敬主语（가세요、읽으셨어요）', '-(으)시-: subject honorific'),
  '-았/었-': L('-았/었-：过去（먹었어요、갔다）', '-았/었-: past tense'),
  '-겠-': L('-겠-：推测、意志（비가 오겠어요、먹겠습니다）', '-겠-: conjecture or intention'),
  '-아/어': L(
    '-아/어：해体（平语）；也是连接形（먹어 보다）',
    '-아/어: informal (해체) ending; also the connective form'
  ),
  '-아요/어요': L(
    '-아요/어요：해요体，日常礼貌，陈述疑问命令劝诱都用',
    '-아요/어요: polite informal (해요체)'
  ),
  '-아서/어서': L(
    '-아서/어서：原因（비가 와서）、先后（가서 먹다）',
    '-아서/어서: because; and then'
  ),
  '-아도/어도': L('-아도/어도：即使……也', '-아도/어도: even if'),
  '-아야/어야': L(
    '-아야/어야：必须……才（-아야 하다 = 得）',
    '-아야/어야: only if; must (with 하다/되다)'
  ),
  '-아야지/어야지': L(
    '-아야지/어야지：得……（决心、劝告）',
    '-아야지/어야지: should, must (resolve, advice)'
  ),
  '-아라/어라': L('-아라/어라：命令（平语、书面）；感叹（좋아라）', '-아라/어라: plain imperative'),
  '-아다가/어다가': L(
    '-아다가/어다가：拿了……再（빌려다가 읽다）',
    '-아다가/어다가: do and then (taking it elsewhere)'
  ),
  '-고': L('-고：并列、先后（먹고 자다）；-고 싶다、-고 있다', '-고: and; and then'),
  '-고서': L('-고서：……之后（先后、方式）', '-고서: after doing'),
  '-고자': L('-고자：想要……（书面）', '-고자: in order to (formal)'),
  '-지': L(
    '-지：否定、能否（-지 않다、-지 못하다）；终结（확인、提议）',
    '-지: with 않다/못하다; sentence-final (confirming)'
  ),
  '-지요': L('-지요：……吧（确认、委婉的提议），口语多说 -죠', '-지요: confirming or suggesting'),
  '-죠': L('-죠：-지요 的缩略', '-죠: short for -지요'),
  '-지만': L('-지만：但是', '-지만: but'),
  '-게': L('-게：……地（副词形，예쁘게）、为了；-게 되다、-게 하다', '-게: adverbial; so that'),
  '-기': L('-기：名词形（……这件事）；-기 전에、-기 때문에', '-기: nominalizer'),
  '-길래': L('-길래：因为（看到对方或情况而作出反应）', '-길래: since (in reaction to something)'),
  '-던': L('-던：回想过去（未完成、反复）的定语', '-던: retrospective adnominal'),
  '-던데': L('-던데：（回想）……呢，可是……', '-던데: retrospective background or exclamation'),
  '-던가': L('-던가：（回想）……来着？', '-던가: retrospective question'),
  '-던지': L('-던지：（回想）不知……', '-던지: retrospective (how much …)'),
  '-더라': L('-더라：（回想、亲见）……呢', '-더라: retrospective statement'),
  '-더라고': L('-더라고：（亲见）我看……；-더라고요', '-더라고: I noticed that …'),
  '-더라도': L('-더라도：即使……也', '-더라도: even if'),
  '-더라면': L('-더라면：要是（当时）……的话', '-더라면: if (counterfactual past)'),
  '-더니': L('-더니：（看到）……之后，结果……', '-더니: and then (observed change)'),
  '-더군': L('-더군：（回想）……呢', '-더군: I noticed … (exclamatory)'),
  '-더구나': L('-더구나：（回想）……呀', '-더구나: retrospective exclamation'),
  '-다가': L('-다가：……着……着（中途转换）', '-다가: while doing, then switch'),
  '-도록': L('-도록：为了、直到、使得', '-도록: so that; until'),
  '-듯이': L('-듯이：像……一样', '-듯이: as if; like'),
  '-듯': L('-듯：-듯이 的缩略', '-듯: short for -듯이'),
  '-자': L('-자：（平语）……吧（劝诱）；一……就', '-자: let’s (plain); as soon as'),
  '-자마자': L('-자마자：一……就', '-자마자: as soon as'),
  '-자고': L('-자고：转述提议（……说一起……）', '-자고: reported suggestion'),
  '-자는': L('-자는：「-자고 하는」的缩略', '-자는: short for -자고 하는'),
  '-곤': L('-곤：-고는 的缩略；-곤 하다 = 常常', '-곤: short for -고는; -곤 하다 = used to'),
  '-거나': L('-거나：或者', '-거나: or'),
  '-거니': L('-거니：……呀（自言自语地确认）', '-거니: exclamatory confirmation'),
  '-거든': L('-거든：如果……的话；（解释）……嘛', '-거든: if; you see'),
  '-네': L('-네：（发现）……呢；하게体', '-네: exclamation on discovery'),
  '-네요': L('-네요：（发现、感叹）……呢', '-네요: polite exclamation on discovery'),
  '-잖아': L('-잖아：不是……嘛（提醒对方已知的事）', '-잖아: you know …'),
  '-잖아요': L('-잖아요：-잖아 的礼貌形', '-잖아요: polite -잖아'),
  '-군': L('-군：（刚发现）……啊', '-군: realizing (exclamation)'),
  '-군요': L('-군요：（刚发现）……啊（礼貌）', '-군요: polite exclamation (realizing)'),
  '-구나': L('-구나：（刚发现）……啊（平语）', '-구나: plain exclamation (realizing)'),
  '-는군요': L('-는군요：动词的 -군요', '-는군요: -군요 after verbs'),
  '-는구나': L('-는구나：动词的 -구나', '-는구나: -구나 after verbs'),
  '-는': L('-는：定语（动词现在、있다/없다）', '-는: present adnominal (verbs)'),
  '-는데': L('-는데：背景、转折；……呢（动词、있다/없다、-았-）', '-는데: background, contrast'),
  '-는지': L('-는지：是否、什么……（间接疑问）', '-는지: whether (indirect question)'),
  '-는가': L('-는가：……吗（书面、自问）', '-는가: question (written)'),
  '-느니': L('-느니：与其……不如', '-느니: rather than'),
  '-느냐': L('-느냐：……吗（平语、书面疑问）', '-느냐: plain question'),
  '-느냐고': L('-느냐고：转述疑问', '-느냐고: reported question'),
  '-나': L('-나：……吗（亲近的疑问）；但是', '-나: casual question; but'),
  '-나요': L('-나요：……吗（柔和的礼貌疑问）', '-나요: soft polite question'),
  '-니': L('-니：……吗（对晚辈、朋友）', '-니: casual question'),
  '-냐': L('-냐：……吗（平语）', '-냐: plain question'),
  '-냐고': L('-냐고：转述疑问', '-냐고: reported question'),
  '-느라고': L('-느라고：因为忙着……（所以没能……）', '-느라고: because (busy) doing'),
  '-느라': L('-느라：-느라고 的缩略', '-느라: short for -느라고'),
  '-다': L('-다：原形、平语陈述（形容词、이다、-았-）；新闻标题', '-다: plain declarative'),
  '-다고': L('-다고：转述陈述（……说）', '-다고: reported statement'),
  '-대': L('-대：「-다고 해」的缩略（听说）', '-대: they say (short for -다고 해)'),
  '-대요': L('-대요：听说……（礼貌）', '-대요: polite hearsay'),
  '-다면': L('-다면：如果……的话（假设）', '-다면: if (hypothetical)'),
  '-다면서': L('-다면서：听说……是吗？；一边说……', '-다면서: I heard that …, right?'),
  '-다며': L('-다며：-다면서 的缩略', '-다며: short for -다면서'),
  '-다니': L('-다니：竟然……（吃惊）', '-다니: surprise (how can …)'),
  '-다니까': L('-다니까：都说了……嘛', '-다니까: I told you …'),
  '-단다': L('-단다：（告诉对方）……哦', '-단다: telling (affectionate)'),
  '-답니다': L('-답니다：（告诉对方）……哦（礼貌）', '-답니다: polite telling'),
  '-다는': L('-다는：「-다고 하는」的缩略', '-다는: short for -다고 하는'),
  '-다시피': L('-다시피：正如……', '-다시피: as (you know)'),
  '-습니다': L('-습니다：합쇼体陈述，最正式', '-습니다: formal polite declarative'),
  '-습니까': L('-습니까：합쇼体疑问', '-습니까: formal polite question'),
  '-습디다': L('-습디다：（回想）……来着（正式）', '-습디다: formal retrospective'),
  '-는다': L('-는다：平语陈述（动词）', '-는다: plain declarative (verbs)'),
  '-는다고': L('-는다고：转述陈述（动词）', '-는다고: reported statement (verbs)'),
  '-는대': L('-는대：听说……（动词）', '-는대: hearsay (verbs)'),
  '-는대요': L('-는대요：听说……（动词，礼貌）', '-는대요: polite hearsay (verbs)'),
  '-는다면': L('-는다면：如果……的话（动词）', '-는다면: if (verbs)'),
  '-는다면서': L('-는다면서：听说……是吗？（动词）', '-는다면서: I heard that … (verbs)'),
  '-는다니': L('-는다니：竟然……（动词）', '-는다니: surprise (verbs)'),
  '-는단다': L('-는단다：（告诉对方）……哦（动词）', '-는단다: telling (verbs)'),
  '-는답니다': L('-는답니다：（告诉对方）……哦（动词，礼貌）', '-는답니다: polite telling (verbs)'),
  '-는다는': L('-는다는：「-는다고 하는」的缩略', '-는다는: short for -는다고 하는'),
  '-(으)면': L('-(으)면：如果……', '-(으)면: if; when'),
  '-(으)니까': L('-(으)니까：因为（理由）；……一看，发现', '-(으)니까: because; when (discovering)'),
  '-(으)니': L('-(으)니：因为（书面）；……吗', '-(으)니: because (written)'),
  '-(으)ㄴ': L(
    '-(으)ㄴ：定语（动词过去、形容词现在）',
    '-(으)ㄴ: adnominal (verb past, adjective present)'
  ),
  '-(으)ㄹ': L('-(으)ㄹ：定语（将要、推测）；-(으)ㄹ 수 있다', '-(으)ㄹ: prospective adnominal'),
  '-(으)ㄹ까': L('-(으)ㄹ까：……吧？（征求意见、推测）', '-(으)ㄹ까: shall we?; I wonder'),
  '-(으)ㄹ까요': L('-(으)ㄹ까요：……好吗？（礼貌）', '-(으)ㄹ까요: shall we? (polite)'),
  '-(으)ㄹ게': L('-(으)ㄹ게：我会……（向对方承诺）', '-(으)ㄹ게: I will (promise)'),
  '-(으)ㄹ게요': L('-(으)ㄹ게요：我会……（礼貌）', '-(으)ㄹ게요: I will (polite)'),
  '-(으)ㄹ래': L('-(으)ㄹ래：想要……；……吗（问意愿）', '-(으)ㄹ래: want to; will you?'),
  '-(으)ㄹ래요': L('-(으)ㄹ래요：想要……（礼貌）', '-(으)ㄹ래요: want to (polite)'),
  '-(으)ㄹ지': L('-(으)ㄹ지：会不会……（间接疑问）', '-(으)ㄹ지: whether (future)'),
  '-(으)ㄹ지라도': L('-(으)ㄹ지라도：即使……也', '-(으)ㄹ지라도: even if'),
  '-(으)ㄹ수록': L('-(으)ㄹ수록：越……越', '-(으)ㄹ수록: the more …, the more'),
  '-(으)ㄹ걸': L('-(으)ㄹ걸：大概……吧；早该……', '-(으)ㄹ걸: probably; should have'),
  '-(으)ㄹ걸요': L('-(으)ㄹ걸요：大概……吧（礼貌）', '-(으)ㄹ걸요: probably (polite)'),
  '-(으)ㄹ망정': L('-(으)ㄹ망정：宁可……也', '-(으)ㄹ망정: even though; rather'),
  '-(으)ㄴ데': L(
    '-(으)ㄴ데：背景、转折（形容词、이다）',
    '-(으)ㄴ데: background, contrast (adjectives)'
  ),
  '-(으)ㄴ지': L('-(으)ㄴ지：是否（形容词）；……以来（时间）', '-(으)ㄴ지: whether; since (time)'),
  '-(으)ㄴ가': L('-(으)ㄴ가：……吗（形容词，书面）', '-(으)ㄴ가: question (adjectives, written)'),
  '-(으)ㄴ가요': L('-(으)ㄴ가요：……吗（形容词，柔和）', '-(으)ㄴ가요: soft question (adjectives)'),
  '-(으)냐': L('-(으)냐：……吗（形容词，平语）', '-(으)냐: plain question (adjectives)'),
  '-(으)ㄴ들': L('-(으)ㄴ들：即使……又能怎样', '-(으)ㄴ들: even if (rhetorical)'),
  '-(으)니까요': L('-(으)니까요：因为……嘛', '-(으)니까요: because (sentence-final)'),
  '-(으)세요': L(
    '-(으)세요：请……（礼貌命令）；尊敬的해요体',
    '-(으)세요: please do; honorific polite'
  ),
  '-(으)셔요': L('-(으)셔요：-(으)세요 的另一种写法', '-(으)셔요: variant of -(으)세요'),
  '-(으)십시오': L('-(으)십시오：请……（最正式的命令）', '-(으)십시오: formal request'),
  '-(으)십시다': L('-(으)십시다：一起……吧（正式、尊敬）', '-(으)십시다: let’s (honorific)'),
  '-(으)ㅂ시다': L('-(으)ㅂ시다：一起……吧（正式）', '-(으)ㅂ시다: let’s (formal)'),
  '-(으)러': L(
    '-(으)러：去（来）做……（目的，后接 가다、오다）',
    '-(으)러: in order to (with go/come)'
  ),
  '-(으)려고': L('-(으)려고：为了、打算', '-(으)려고: intending to'),
  '-(으)려면': L('-(으)려면：要想……的话', '-(으)려면: if you want to'),
  '-(으)려다가': L('-(으)려다가：本想……（却）', '-(으)려다가: was about to … but'),
  '-(으)려는': L('-(으)려는：打算……的（定语）', '-(으)려는: intending to (adnominal)'),
  '-(으)려': L('-(으)려：-(으)려고 的缩略', '-(으)려: short for -(으)려고'),
  '-(으)면서': L('-(으)면서：一边……一边；却', '-(으)면서: while'),
  '-(으)며': L('-(으)며：并且、一边（书面）', '-(으)며: and; while (written)'),
  '-(으)므로': L('-(으)므로：因为（书面）', '-(으)므로: because (written)'),
  '-(으)ㅁ': L('-(으)ㅁ：名词形（书面、告示）', '-(으)ㅁ: nominalizer'),
  '-(으)라고': L('-(으)라고：转述命令', '-(으)라고: reported command'),
  '-(으)라는': L('-(으)라는：「-(으)라고 하는」的缩略', '-(으)라는: short for -(으)라고 하는'),
  '-(으)래요': L('-(으)래요：（听说）让……（礼貌）', '-(으)래요: they told me to (polite)'),
  '-(으)래': L('-(으)래：（听说）让……', '-(으)래: they told me to'),
  '-(으)라': L('-(으)라：命令（书面、间接）', '-(으)라: imperative (written, indirect)'),
  '-(으)나': L('-(으)나：但是（书面）', '-(으)나: but (written)'),
  '-(으)리라': L('-(으)리라：将会……（书面、文学）', '-(으)리라: will (literary)')
}

/** 助词（标签与 particles.ts 的 label 一致） */
const PARTICLES: Record<string, LocalizedText> = {
  '이/가': L('이/가：主格助词（谁、什么）', '이/가: subject marker'),
  께서: L('께서：主格助词的敬语', '께서: honorific subject marker'),
  '을/를': L('을/를：宾格助词', '을/를: object marker'),
  의: L('의：……的（属格）', '의: possessive'),
  에: L('에：时间、地点（在、到）、对象', '에: at, in, to (time, place)'),
  에서: L('에서：在（动作的地点）；从', '에서: at (place of action); from'),
  에게: L('에게：给、对（人、动物）', '에게: to (a person)'),
  에게서: L('에게서：从（人）', '에게서: from (a person)'),
  한테: L('한테：给、对（口语）', '한테: to (a person, spoken)'),
  한테서: L('한테서：从（人，口语）', '한테서: from (a person, spoken)'),
  께: L('께：给、对（敬语）', '께: to (honorific)'),
  '(으)로': L('(으)로：方向、手段、身份、变化的结果', '(으)로: toward; by means of; as'),
  '(으)로서': L('(으)로서：作为（身份、资格）', '(으)로서: as (status)'),
  '(으)로써': L('(으)로써：用、凭（手段）', '(으)로써: by means of'),
  '(으)로부터': L('(으)로부터：从（起点、来源）', '(으)로부터: from'),
  '와/과': L('와/과：和、跟（书面）', '와/과: and, with'),
  하고: L('하고：和、跟（口语）', '하고: and, with (spoken)'),
  '(이)랑': L('(이)랑：和、跟（口语）', '(이)랑: and, with (casual)'),
  보다: L('보다：比', '보다: than'),
  처럼: L('처럼：像……一样', '처럼: like'),
  같이: L('같이：像……一样', '같이: like'),
  만큼: L('만큼：跟……一样（程度）', '만큼: as … as'),
  대로: L('대로：按照', '대로: according to'),
  에다가: L('에다가：在……上（添加、放置）', '에다가: onto, in addition to'),
  더러: L('더러：对（人，口语）', '더러: to (a person, colloquial)'),
  '아/야': L('아/야：呼格（叫人：민수야）', '아/야: vocative'),
  '(이)여': L('(이)여：呼格（书面、诗）', '(이)여: vocative (literary)'),
  '은/는': L('은/는：话题、对比', '은/는: topic or contrast marker'),
  도: L('도：也、连……都', '도: also, even'),
  만: L('만：只', '만: only'),
  까지: L('까지：到（终点）；连……都', '까지: until, up to; even'),
  부터: L('부터：从（起点）', '부터: from (starting point)'),
  마다: L('마다：每', '마다: every'),
  밖에: L('밖에：只、除了……以外（后接否定）', '밖에: nothing but (with a negative)'),
  뿐: L('뿐：只', '뿐: only'),
  조차: L('조차：连……都（意外、不好的事）', '조차: even (unexpected)'),
  마저: L('마저：连……也（最后一个）', '마저: even (the last one)'),
  '(이)나': L('(이)나：或者；竟有（多）；随便……', '(이)나: or; as many as; any'),
  '(이)라도': L('(이)라도：哪怕是……也好（退而求其次）', '(이)라도: even if (it is only)'),
  '(이)든지': L('(이)든지：无论……都', '(이)든지: whether, any'),
  '(이)야': L('(이)야：……才（强调）', '(이)야: only then (emphasis)'),
  '(이)야말로': L('(이)야말로：……才是（强调）', '(이)야말로: precisely'),
  '(이)나마': L('(이)나마：虽然只是……也', '(이)나마: though only'),
  '(이)며': L('(이)며：和……（列举）', '(이)며: and (listing)'),
  '(이)라고': L('(이)라고：引用（叫作……）', '(이)라고: quoting; called'),
  '(이)란': L('(이)란：所谓……（下定义）', '(이)란: (what is called) …'),
  치고: L('치고：作为……来说；凡是……', '치고: for a …; every'),
  커녕: L('커녕：别说……（连……都没有）', '커녕: let alone'),
  '은/는커녕': L('은/는커녕：别说……', '은/는커녕: let alone'),
  따라: L('따라：（偏偏）在……', '따라: (of all days) on'),
  요: L('요：礼貌（加在词、助词、连接形后面）', '요: polite marker'),
  '-들': L('-들：复数', '-들: plural'),
  '-쯤': L('-쯤：大约', '-쯤: about'),
  '-씩': L('-씩：每……（分配）', '-씩: each'),
  '-째': L('-째：第……；整……', '-째: -th; whole'),
  이다: L('이다：是（叙述格助词，接在体词后面）', '이다: copula (to be)')
}

/** 连写的补助用言（splitAuxiliary 的标签） */
const AUX: Record<string, LocalizedText> = {
  주다: L('주다：（为别人）做……', '주다: do for someone'),
  드리다: L('드리다：（为长辈）做……', '드리다: do for someone (humble)'),
  보다: L('보다：试着……', '보다: try doing'),
  버리다: L('버리다：（干脆、遗憾地）……掉了', '버리다: end up doing, completely'),
  놓다: L('놓다：做好放着', '놓다: do in advance'),
  두다: L('두다：做好留着', '두다: do and keep'),
  내다: L('내다：（克服困难）做到', '내다: manage to'),
  가다: L('가다：（渐渐）……下去', '가다: keep doing, gradually'),
  오다: L('오다：（一直）……过来', '오다: have been doing'),
  있다: L('있다：（结果状态）……着；-고 있다 = 正在', '있다: state; with -고: progressive'),
  지다: L('지다：被……、变得……', '지다: become; passive'),
  대다: L('대다：一个劲儿地……', '대다: keep doing (intensely)'),
  싶다: L('싶다：想……（-고 싶다）', '싶다: want to (-고 싶다)'),
  않다: L('않다：不……（-지 않다）', '않다: not (-지 않다)'),
  못하다: L('못하다：不能……（-지 못하다）', '못하다: cannot (-지 못하다)'),
  말다: L('말다：别……（-지 말다）；终于……（-고 말다）', '말다: don’t; end up'),
  하다: L(
    '하다：词典里没有「X하다」时，退回到名词 X',
    '하다: X하다 not in the dictionary: shown as noun X'
  ),
  되다: L(
    '되다：词典里没有「X되다」时，退回到名词 X',
    '되다: X되다 not in the dictionary: shown as noun X'
  ),
  시키다: L(
    '시키다：词典里没有「X시키다」时，退回到名词 X',
    '시키다: X시키다 not in the dictionary: shown as noun X'
  )
}

/** 活用类别、词性细分（cls） */
const CLASSES: Record<string, LocalizedText> = {
  'ㅂ 불규칙': L(
    'ㅂ 不规则：ㅂ 在元音前变 우（춥다 → 추워요）',
    'ㅂ-irregular: ㅂ becomes 우 before vowels'
  ),
  'ㄷ 불규칙': L(
    'ㄷ 不规则：ㄷ 在元音前变 ㄹ（듣다 → 들어요）',
    'ㄷ-irregular: ㄷ becomes ㄹ before vowels'
  ),
  'ㅅ 불규칙': L(
    'ㅅ 不规则：ㅅ 在元音前脱落（낫다 → 나아요）',
    'ㅅ-irregular: ㅅ drops before vowels'
  ),
  '르 불규칙': L(
    '르 不规则：르 + 아/어 → ㄹ라/ㄹ러（모르다 → 몰라요）',
    '르-irregular: 르 + 아/어 → ㄹ라/ㄹ러'
  ),
  '러 불규칙': L('러 不规则：接 -어 时多出 러（이르다 → 이르러）', '러-irregular: -어 becomes -러'),
  'ㅎ 불규칙': L(
    'ㅎ 不规则：ㅎ 脱落、元音变化（파랗다 → 파래요、파란）',
    'ㅎ-irregular: ㅎ drops, vowel changes'
  ),
  '우 불규칙': L('우 不规则：우 + 어 → 어（푸다 → 퍼요）', '우-irregular: 우 + 어 → 어'),
  '여 불규칙': L(
    '여 不规则：하 + 아 → 해 / 하여（하다 → 해요）',
    '여-irregular: 하 + 아 → 해 / 하여'
  ),
  'ㄹ 탈락': L(
    'ㄹ 脱落：遇 ㄴ、ㅂ、ㅅ 开头的词尾，ㄹ 脱落（살다 → 사는、삽니다）',
    'ㄹ-dropping before ㄴ, ㅂ, ㅅ'
  ),
  '으 탈락': L('으 脱落：ㅡ 在 아/어 前脱落（쓰다 → 써요）', '으-dropping before 아/어'),
  '의존 명사': L('依存名词：不能单独用（것、수、때문）', 'Dependent noun'),
  '보조 동사': L('补助动词：接在别的动词后面（-고 있다、-어 주다）', 'Auxiliary verb'),
  '보조 형용사': L('补助形容词（-고 싶다）', 'Auxiliary adjective'),
  krdict: L('词典给的活用形', 'form given by the dictionary')
}

/** 特有字段 */
const FIELDS: Record<string, LocalizedText> = {
  'x.origin': L('原语', 'Origin'),
  'x.krdict': L('한국어기초사전', 'Basic Korean Dictionary')
}

export const labels: Record<string, LocalizedText> = {
  ...ENDINGS,
  ...PARTICLES,
  ...AUX,
  ...CLASSES,
  ...FIELDS
}
