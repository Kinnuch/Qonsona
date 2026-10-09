/**
 * 视听：字幕文件的解码与解析（SRT、WebVTT、ASS、LRC）、按时间找字幕、第二字幕对齐。
 */
import { describe, expect, it } from 'vitest'
import {
  cleanCueText,
  cueAt,
  decodeText,
  formatTime,
  lastStarted,
  mediaKind,
  overlapping,
  parseSubtitles,
  parseTime
} from '$shared/media'

describe('时间', () => {
  it('SRT、VTT、ASS 的几种写法', () => {
    expect(parseTime('00:01:02,345')).toBeCloseTo(62.345)
    expect(parseTime('01:02.5')).toBeCloseTo(62.5)
    expect(parseTime('1:02:03.45')).toBeCloseTo(3723.45)
    expect(parseTime('00:00:05')).toBe(5)
    expect(parseTime('abc')).toBeNull()
  })

  it('写回去', () => {
    expect(formatTime(62.9)).toBe('1:02')
    expect(formatTime(3723)).toBe('1:02:03')
  })
})

describe('字幕解析', () => {
  it('SRT：编号、时间、多行文字，去掉样式标签', () => {
    const srt = `1
00:00:01,000 --> 00:00:03,500
<i>こんにちは</i>

2
00:00:04,000 --> 00:00:06,000 X1:10 X2:20
{\\an8}元気ですか。
はい。
`
    expect(parseSubtitles(srt, 'a.srt')).toEqual([
      { start: 1, end: 3.5, text: 'こんにちは' },
      { start: 4, end: 6, text: '元気ですか。\nはい。' }
    ])
  })

  it('WebVTT：没有小时、有注释块和说话人、振假名只留正文', () => {
    const vtt = `WEBVTT

NOTE 这是注释

intro
00:01.000 --> 00:02.500 align:start
<v 田中>おはよう</v>

00:03.000 --> 00:04.000
<ruby>漢字<rt>かんじ</rt></ruby>を<c.yellow>書く</c>
`
    expect(parseSubtitles(vtt, 'a.vtt')).toEqual([
      { start: 1, end: 2.5, text: 'おはよう' },
      { start: 3, end: 4, text: '漢字を書く' }
    ])
  })

  it('ASS：按 Format 行取列，文字里的逗号保留，\\N 换行', () => {
    const ass = `[Script Info]
Title: test

[V4+ Styles]
Format: Name, Fontname
Style: Default,Arial

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.50,0:00:03.00,Default,,0,0,0,,{\\i1}ええ、そうです\\Nね
Comment: 0,0:00:04.00,0:00:05.00,Default,,0,0,0,,注释不要
Dialogue: 0,0:00:06.00,0:00:07.25,Default,,0,0,0,,一つ、二つ、三つ
`
    expect(parseSubtitles(ass, 'a.ass')).toEqual([
      { start: 1.5, end: 3, text: 'ええ、そうです\nね' },
      { start: 6, end: 7.25, text: '一つ、二つ、三つ' }
    ])
  })

  it('LRC：一行几个时间、到下一句开始为止，最后一句 4 秒；元数据不算', () => {
    const lrc = `[ar:someone]
[00:01.00][00:10.00]ラララ
[00:05.50]歌う
[00:12:50]おわり`
    expect(parseSubtitles(lrc, 'a.lrc')).toEqual([
      { start: 1, end: 5.5, text: 'ラララ' },
      { start: 5.5, end: 10, text: '歌う' },
      { start: 10, end: 12.5, text: 'ラララ' },
      { start: 12.5, end: 16.5, text: 'おわり' }
    ])
  })

  it('没有扩展名时看内容；空句子丢掉', () => {
    expect(
      parseSubtitles('1\n00:00:01,000 --> 00:00:02,000\n\n2\n00:00:03,000 --> 00:00:04,000\nあ\n')
    ).toEqual([{ start: 3, end: 4, text: 'あ' }])
  })

  it('去标签', () => {
    expect(cleanCueText('<b>強い</b>&amp;<00:00:01.000>速い\\h!')).toBe('強い&速い !')
  })
})

describe('按时间找字幕', () => {
  const cues = [
    { start: 1, end: 2, text: 'a' },
    { start: 3, end: 5, text: 'b' },
    { start: 5, end: 6, text: 'c' }
  ]

  it('落在哪一句；两句之间是 -1；字幕整体延后', () => {
    expect(cueAt(cues, 0.5)).toBe(-1)
    expect(cueAt(cues, 1.5)).toBe(0)
    expect(cueAt(cues, 2.5)).toBe(-1)
    expect(lastStarted(cues, 2.5)).toBe(0)
    expect(cueAt(cues, 5)).toBe(2)
    expect(cueAt(cues, 2.5, 1)).toBe(0)
  })

  it('第二字幕按重叠最多的对齐', () => {
    const zh = [
      { start: 0.9, end: 2.1, text: '甲' },
      { start: 2.9, end: 4.2, text: '乙' },
      { start: 4.3, end: 6, text: '丙' }
    ]
    expect(overlapping(zh, 1, 2)).toBe(0)
    expect(overlapping(zh, 3, 5)).toBe(1)
    expect(overlapping(zh, 7, 8)).toBe(-1)
  })
})

describe('文件', () => {
  it('按扩展名分视频和音频', () => {
    expect(mediaKind('ep01.MKV')).toBe('video')
    expect(mediaKind('podcast.mp3')).toBe('audio')
    expect(mediaKind('a.srt')).toBeNull()
  })

  it('字幕的编码：BOM、UTF-8、Shift_JIS、GB18030', () => {
    const utf8 = new TextEncoder().encode('こんにちは')
    expect(decodeText(utf8)).toBe('こんにちは')
    expect(decodeText(new Uint8Array([0xef, 0xbb, 0xbf, ...utf8]))).toBe('こんにちは')
    expect(decodeText(new Uint8Array([0xff, 0xfe, 0x42, 0x30]))).toBe('あ')
    // 「あいう」的 Shift_JIS
    expect(decodeText(new Uint8Array([0x82, 0xa0, 0x82, 0xa2, 0x82, 0xa4]))).toBe('あいう')
    // 「中文」的 GBK
    expect(decodeText(new Uint8Array([0xd6, 0xd0, 0xce, 0xc4]))).toBe('中文')
  })
})
