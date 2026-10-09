# 外语词条释义：英译中规范

你在给一个面向中文母语者的外语学习词典补中文释义（语言见任务说明：英语、法语、韩语、西班牙语、阿拉伯语、
俄语或苏格兰盖尔语）。原始数据是维基词典等来源的英文释义。

## 输入与输出

输入文件 `.cache/mt/<代码>/in/part-NNN.tsv`，每行一个词条，制表符分隔四栏：

```
12	maison	noun	[noun] house; home ‖ [noun] household, family ‖ [noun] firm, company
```

- 第一栏序号，第二栏词头（这门语言的词），第三栏主要词性，第四栏是用「 ‖ 」隔开的义项；每个义项开头方括号里是
  这个义项的词性，后面是用分号隔开的几条英文释义。

输出文件 `.cache/mt/<代码>/out/part-NNN.tsv`（NNN 与输入相同），每行一个词条，制表符分隔两栏：

```
12	房子；家 ‖ 家庭；一家人 ‖ 公司；商行
```

- 第一栏序号；第二栏是中文释义，**义项个数必须和输入完全一样**，按顺序用「 ‖ 」（空格 + U+2016 + 空格）隔开。
- **每个输入词条一行，顺序与输入相同，一个都不能少**。不要输出词头、词性。

## 怎么译

1. **简体中文**，词典释义的写法：简短、准确，不写成句子，不加句号。
2. 一个义项里几条英文是同义说法：合并成一到三个中文说法，用全角分号「；」隔开；意思重复的只留一个。
3. **以英文释义为准**，参考词头和词性判断具体指什么；不要凭自己对这门语言的知识增加英文里没有的意思，
   也不要删掉英文里有的意思。
4. 英文释义是一句**解释**（尤其是英语词条：`To move swiftly on foot…`）时，给出这个义项对应的**中文词语**
   （`跑；奔跑`），解释里限定用法的部分放进全角括号（`（在比赛中）跑`），不要把整句解释翻成一句话。
5. 动词不要译出 “to”：`to eat` → `吃`；`to be surprised` → `吃惊；惊讶`。
6. 英文括号里的补充说明译成中文放进全角括号：`to raise (a wage)` → `提高（工资）`；举例可以写「（如：……）」，
   太啰嗦的可以省略。表示语域、地区的标注（colloquial、Britain、Quebec）译成「〔口〕」「〔英国〕」「〔魁北克〕」放在开头。
7. 英文里用 something / someone 表示的空位，中文用「……」：`to show someone (into a room)` → `把……领进（房间）`。
8. 语法词（冠词、介词、助词、词尾、小品词）：英文多半是说明（`indicates the direct object`），译成说明：
   `表示动作的直接宾语`。英文给的是对应词的（`of; from`）照译（`……的；从`）。
9. 屈折形式的说明（`plural of maison`、`first-person singular present indicative of manger`）：
   译成「maison 的复数」「manger 的直陈式现在时第一人称单数」，词照抄原文。
10. 专有名词、品牌、人名、地名才音译或保留原文；化学式、单位、数字、拉丁字母缩写照抄。
11. **同形词**：同一个英文词在这里可能是别的意思（`bank` 是银行还是河岸），按词头、词性、同一义项里的其他说法判断。
12. 实在没法译的（英文就是一个外文专名），照抄英文。
13. 译文里不要出现制表符和「‖」。

## 各语言的注意事项

- **韩语**：汉字词（한자어）不要按汉字的中文意思直译，一律按英文意思译；表示敬语、语气的词尾写清楚（「〔敬语〕」）。
- **阿拉伯语**：英文里的 verbal noun of…、form II of… 这类说明译成「……的动名词」「……的第二式」。
- **俄语**：英文写了体（perfective / imperfective）的，译文前加「〔完〕」「〔未完〕」。
- **法语、西班牙语**：阴阳性的说明（feminine of…）译成「……的阴性形式」。
- **苏格兰盖尔语**：词首音变的说明（lenited form of…）译成「……的弱化形」。

## 交付

- 按分配给你的份数，逐份处理：用 Bash 的 `cat` 读一份输入（一份最多约一万两千字，一次能读完），
  译完立刻用 Write 写出对应的输出文件，再读下一份。不要一次读很多份。
- 全部写完后用下面的命令检查你负责的每一份（把 `<代码>` 换成语言代码、NNN 换成份号），
  行数与每行义项数都要对得上，不对就改：

```
node -e "const fs=require('fs');const c=process.argv[1];for(const n of process.argv.slice(2)){const a=fs.readFileSync('.cache/mt/'+c+'/in/part-'+n+'.tsv','utf8').trim().split('\n'),b=fs.readFileSync('.cache/mt/'+c+'/out/part-'+n+'.tsv','utf8').trim().split('\n');let bad=a.length!==b.length?['行数 '+b.length+'≠'+a.length]:[];a.forEach((l,i)=>{const x=l.split('\t'),y=(b[i]||'').split('\t');if(x[0]!==y[0])bad.push('第'+(i+1)+'行序号');else if(x[3].split(' ‖ ').length!==(y[1]||'').split(/\s*‖\s*/).length)bad.push(x[1]+' 义项数')});console.log(n,bad.length?bad.join('，'):'OK')}" <代码> NNN NNN …
```

（在仓库根目录 `C:\Users\Administrator\Documents\GitHub\Qonsona` 下运行。）
- 不要改输入文件，不要动别人负责的输出文件，也不要动仓库里的其他文件。
