import type { LexGrammarPoint } from '../types'
export const additional: LexGrammarPoint[] = []
function add(raw: string): void {
  for (const line of raw.trim().split('\n')) {
    const [level, key, zh, en, meaningZh, meaningEn, ...sentences] = line.split('|')
    additional.push({
      id: `gd-${key}`,
      level,
      name: { zh, en },
      form: { zh, en },
      meaning: { zh: meaningZh, en: meaningEn },
      group: key,
      examples: sentences.map((s) => {
        const [text, hl, zh, en] = s.split('~')
        return { text, hl, zh, en }
      })
    })
  }
}
add(`
A1|personal-pronouns|人称代词|Personal pronouns|mi/thu/e/i/sinn/sibh/iad 表人称，sibh 也可用于礼貌单数。|Mi, thu, e, i, sinn, sibh and iad distinguish person; sibh also addresses one person politely.|Tha sinn deiseil.~sinn~我们准备好了。~We are ready.|Tha iad toilichte.~iad~他们开心。~They are happy.
A1|negative-bi|现在否定|Negative present bi|tha 的否定是 chan eil，不是 chan tha。|The negative counterpart of tha is chan eil, not chan tha.|Chan eil mi sgìth.~Chan eil~我不累。~I am not tired.|Chan eil e fuar.~Chan eil~天气不冷。~It is not cold.
A1|copula-name|系词身份|Copular identity|is mise 等系词结构表身份，与 tha 表状态区分。|Copular is mise identifies a person, contrasting with tha for states and locations.|Is mise Màiri.~Is mise~我是玛丽。~I am Mary.|Is esan Iain.~Is esan~他是伊恩。~He is John.
A1|indefinite-nouns|无不定冠词|No indefinite article|盖尔语没有 a/an 对应的不定冠词，裸名词可表示一个。|Gaelic has no indefinite article corresponding to English a or an; a bare noun can be indefinite.|Tha leabhar agam.~leabhar~我有一本书。~I have a book.|Tha taigh aca.~taigh~他们有一所房子。~They have a house.
A1|noun-adjective|后置形容词|Postnominal adjectives|普通描述形容词一般在名词后，不能按英语前置。|Ordinary descriptive adjectives normally follow the noun.|Tha taigh beag agam.~taigh beag~我有一所小房子。~I have a small house.|Tha cù mòr aig Iain.~cù mòr~伊恩有一只大狗。~John has a big dog.
A1|likes-le|喜好 le 介词代词|Likes with le|is toil le 加人称形式表喜欢，leam/leat/leatha 等不是主格代词。|Is toil le plus an inflected preposition expresses liking; leam, leat and leatha are not subject pronouns.|Is toil leam ceòl.~Is toil leam~我喜欢音乐。~I like music.|Is toil leatha Gàidhlig.~Is toil leatha~她喜欢盖尔语。~She likes Gaelic.
A1|numbers-simple|二与三的计数|Counting two and three|dà 后用单数形且可弱化；trì 常用复数形；变化逐词学习。|Dà takes a singular form, often lenited; trì commonly takes a plural form, learned noun by noun.|Tha dà chù agam.~dà chù~我有两只狗。~I have two dogs.|Tha trì cait agam.~trì cait~我有三只猫。~I have three cats.
A2|article-masculine|阳性定冠词|Masculine definite article|阳性单数主格常用 an/am，b/f/m/p 前常用 am。|Masculine singular nominatives commonly use an, with am before b, f, m or p.|Tha am balach an seo.~am balach~男孩在这里。~The boy is here.|Tha an cù mòr.~an cù~狗很大。~The dog is big.
A2|article-feminine|阴性定冠词弱化|Feminine article lenition|阴性单数主格可用 a’ 加弱化辅音；不是所有词首都相同。|Many feminine singular nominatives use a’ plus a lenited consonant; initial letters require different article forms.|Tha a’ bhean aig an taigh.~a’ bhean~女人在家。~The woman is at home.|Tha a’ chaileag anns an sgoil.~a’ chaileag~女孩在学校。~The girl is at school.
A2|article-prothesis|冠词 t-/h-|Article prothesis|阳性单数元音前用 an t-；复数元音前常用 na h-。|A masculine singular vowel-initial noun takes an t-; vowel-initial plurals commonly take na h-.|Tha an t-uisge fuar.~an t-uisge~水很冷。~The water is cold.|Tha na h-òrain brèagha.~na h-òrain~歌很美。~The songs are beautiful.
`)
add(`
A2|demonstratives|后置指示词|Postnominal demonstratives|seo 和 sin 放在带定冠词的名词后，指这一个与那一个。|Seo and sin follow a definite noun to distinguish this from that.|Tha an leabhar seo ùr.~an leabhar seo~这本书是新的。~This book is new.|Tha an taigh sin mòr.~an taigh sin~那所房子很大。~That house is big.
A2|preposition-le|le 的人称形式|Personal forms of le|le 与代词融合：leam、leat、leis、leatha 等；表示与谁一起须看语境。|Le combines with pronouns in forms such as leam, leat, leis and leatha; its sense depends on context.|Thig leam.~leam~和我一起来。~Come with me.|Tha Màiri còmhla leatha.~leatha~玛丽和她在一起。~Mary is with her.
A2|preposition-air|air 与感受|Air and experiences|air 的人称形式如 orm、ort、oirre；饥渴和某些感受用此结构。|Personal forms of air include orm, ort and oirre; some experiences use this construction.|Tha an t-acras orm.~an t-acras orm~我饿了。~I am hungry.|Tha eagal oirre.~eagal oirre~她害怕。~She is afraid.
A2|plural-article|复数定冠词|Plural definite articles|主格复数一般用 na；元音前加 h-，不要套用单数弱化规则。|Nominative plurals normally take na, with h- before a vowel; singular lenition rules do not apply automatically.|Tha na balaich an seo.~na balaich~男孩们在这里。~The boys are here.|Tha na h-uinneagan fosgailte.~na h-uinneagan~窗户开着。~The windows are open.
A2|obligation|feumaidh 与必要|Obligation with feumaidh|feumaidh 加人称和动名词表达必须；不要直接套英语不定式。|Feumaidh with a subject and verbal noun expresses obligation.|Feumaidh mi falbh.~Feumaidh mi falbh~我必须离开。~I must leave.|Feumaidh sinn obair.~Feumaidh sinn obair~我们必须工作。~We must work.
A2|ability|能力与 do 介词代词|Ability and personal do|is urrainn 加 dhomh、dhut、dhi 等人称形式，再接动名词。|Is urrainn uses personal forms of do such as dhomh, dhut and dhi before a verbal noun.|Is urrainn dhomh snàmh.~Is urrainn dhomh~我会游泳。~I can swim.|Is urrainn dhi seinn.~Is urrainn dhi~她会唱歌。~She can sing.
B1|want|愿望与 ag iarraidh|Wanting with ag iarraidh|tha 加人称加 ag iarraidh 表达愿望，可接名词或动名词。|Tha with a subject and ag iarraidh expresses wanting, followed by a noun or verbal noun.|Tha mi ag iarraidh uisge.~ag iarraidh uisge~我想要水。~I want water.|Tha iad ag iarraidh falbh.~ag iarraidh falbh~他们想离开。~They want to leave.
B1|advice|bu chòir 建议|Advice with bu chòir|bu chòir 加 do 人称形式与动名词表达应该，不把人称代词直接接在后面。|Bu chòir with a personal form of do and a verbal noun expresses should.|Bu chòir dhut fois a ghabhail.~Bu chòir dhut~你应该休息一下。~You should take a rest.|Bu chòir dhuinn èisteachd.~Bu chòir dhuinn~我们应该倾听。~We should listen.
B1|past-dependent|robh 的从属形式|Dependent past robh|过去疑问用 an robh，否定用 cha robh；不要在这些环境保留 bha。|Past questions use an robh and negatives cha robh rather than independent bha.|An robh thu aig an taigh?~An robh~你当时在家吗？~Were you at home?|Cha robh iad deiseil.~Cha robh~他们当时没准备好。~They were not ready.
B1|irregular-past|常用不规则过去式|Common irregular past forms|rach 与 faic 的过去肯定分别为 chaidh 与 chunnaic；从属式需另外学习。|Rach and faic have independent past forms chaidh and chunnaic; their dependent forms must be learned separately.|Chaidh i dhan sgoil.~Chaidh~她去了学校。~She went to school.|Chunnaic mi Màiri.~Chunnaic~我看到了玛丽。~I saw Mary.
B1|embedded-future|gum bi 与将来从句|Embedded future gum bi|在肯定报告或愿望从句中用 gum bi，否定从句用 nach bi。|Affirmative reported or desired future clauses use gum bi; negative clauses use nach bi.|Tha mi an dòchas gum bi e math.~gum bi~我希望它会很好。~I hope it will be good.|Tha fios agam nach bi i ann.~nach bi~我知道她不会在那里。~I know she will not be there.
B1|equality|cho 与同等比较|Equality with cho|cho 加形容词加 ri 进行同等比较；ri 遇代词有自己的形式。|Cho plus adjective and ri expresses an equal comparison; ri has personal forms before pronouns.|Tha Iain cho àrd ri Màiri.~cho àrd ri~伊恩和玛丽一样高。~John is as tall as Mary.|Tha an cù cho mòr ris a’ chat.~cho mòr ris a’ chat~狗和猫一样大。~The dog is as big as the cat.
B1|ages|年龄与单数 bliadhna|Ages with singular bliadhna|年龄用数字加单数 bliadhna 加 a dh’aois；不要机械套复数。|Ages use a number with singular bliadhna and a dh’aois rather than a mechanically pluralized noun.|Tha mi fichead bliadhna a dh’aois.~fichead bliadhna a dh’aois~我二十岁。~I am twenty years old.|Tha i trithead bliadhna a dh’aois.~trithead bliadhna a dh’aois~她三十岁。~She is thirty years old.
B1|real-condition|ma 与真实条件|Real conditions with ma|ma tha 表现在条件，ma bhios 表将来条件；与假设 nam biodh 区分。|Ma tha presents a present condition and ma bhios a future one, contrasting with hypothetical nam biodh.|Ma tha thu deiseil, thèid sinn a-mach.~Ma tha~如果你准备好了，我们就出门。~If you are ready, we will go out.|Ma bhios e fliuch, fuirichidh sinn aig an taigh.~Ma bhios~如果下雨，我们会留在家里。~If it rains, we will stay at home.
B2|hypothetical|nam biodh 与假设|Hypothetical nam biodh|假设条件用 nan/nam 与从属条件式；主句相应使用条件式。|Hypothetical conditions use nan or nam with a dependent conditional and a conditional result clause.|Nam biodh ùine agam, rachainn dhan leabharlann.~Nam biodh~如果我有时间，我会去图书馆。~If I had time, I would go to the library.|Nam biodh e an seo, bhiodh sinn toilichte.~Nam biodh~如果他在这里，我们会很开心。~If he were here, we would be happy.
B2|concession|ged a 与让步|Concession with ged a|ged a tha 引入现在让步，强调前述情况不阻止主句。|Ged a tha introduces a present concession: the stated circumstance does not prevent the main event.|Ged a tha e fuar, thèid sinn a-mach.~Ged a tha~虽然天冷，我们仍会出门。~Although it is cold, we will go out.|Ged a tha mi sgìth, tha mi ag obair.~Ged a tha~虽然我累了，我仍在工作。~Although I am tired, I am working.
B2|verbal-noun-object|动名词宾语前置|Objects before verbal nouns|在某些不定动名词结构中，宾语在动名词前，中间用 a 并发生适当弱化。|In certain infinitival verbal-noun constructions, the object precedes the verbal noun, linked by a and appropriate lenition.|Feumaidh mi an leabhar a leughadh.~an leabhar a leughadh~我必须读这本书。~I must read the book.|Tha mi airson Gàidhlig a bhruidhinn.~Gàidhlig a bhruidhinn~我想说盖尔语。~I want to speak Gaelic.
B2|relative-past|过去直接关系句|Direct relatives in the past|a 引入直接过去关系句，规则动词通常弱化；元音前常出现 dh’。|Direct past relatives use a, usually with lenition; vowel-initial verbs commonly show dh’.|Seo an leabhar a sgrìobh mi.~a sgrìobh mi~这是我写的书。~This is the book I wrote.|Seo an t-òran a dh’ionnsaich mi.~a dh’ionnsaich mi~这是我学过的歌。~This is the song I learned.
B2|relative-future|bhios 关系形式|Relative future bhios|bi 的将来直接关系形式是 bhios，区别于独立 bidh 和从属 bi。|The direct relative future of bi is bhios, contrasting with independent bidh and dependent bi.|Seo an duine a bhios an seo a-màireach.~a bhios~这是明天会在这里的人。~This is the person who will be here tomorrow.|Tha fios agam cò a bhios ann.~a bhios~我知道谁会在那里。~I know who will be there.
B2|reported-past|gun robh 与过去转述|Reported past gun robh|报告过去状态用 gun robh，否定过去转述用 nach robh。|Reported past states use gun robh; negative reports use nach robh.|Thuirt i gun robh i sgìth.~gun robh~她说她累了。~She said she was tired.|Thuirt e nach robh airgead aige.~nach robh~他说他没有钱。~He said he had no money.
`)
