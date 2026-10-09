/**
 * 框架里各语言的词典数据库（resources/data/<代码>/dict.sqlite）的结构，数据管线写、主进程读都用这一份。
 * 说明见 docs/lang-kit.md「词典数据库」。
 */
import { deflateRawSync, inflateRawSync } from 'node:zlib'
import type { LexEntryData } from '../../shared/lang/types'

/** 结构改了就加一；主进程读到不认识的版本时当作没有数据 */
export const SCHEMA_VERSION = 'lexdb-1'

export const SCHEMA_SQL = `
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
-- 词条：data 是 deflate-raw 压缩的 JSON（LexEntryData）；lv 是主分级的等级，fr 是词频名次（1 最常用）
CREATE TABLE entry (
  id INTEGER PRIMARY KEY,
  w TEXT NOT NULL,
  p TEXT NOT NULL,
  fr INTEGER,
  lv TEXT,
  data BLOB NOT NULL
);
-- 查词的键：每个写法、每个变形一行；key 是 rules.key() 规整过的，loose = 1 表示去掉变音符号的宽松键
CREATE TABLE form (
  key TEXT NOT NULL,
  entry INTEGER NOT NULL,
  form TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '',
  loose INTEGER NOT NULL DEFAULT 0
);
-- 释义整条对上（英文小写、去掉开头的 to；中文按分号、逗号拆开）
CREATE TABLE gloss_key (key TEXT NOT NULL, lang TEXT NOT NULL, entry INTEGER NOT NULL, PRIMARY KEY (key, lang, entry)) WITHOUT ROWID;
-- 英文释义按单词全文检索：rowid 就是词条号，同一个词条的几条释义拼成一行，不存原文
CREATE VIRTUAL TABLE gloss USING fts5(text, content = '', columnsize = 0, detail = 'none', tokenize = 'unicode61 remove_diacritics 2');
-- 例句：zs 是中文翻译的来源（mt- 开头是机器翻译）
CREATE TABLE example (id INTEGER PRIMARY KEY, text TEXT NOT NULL, en TEXT, zh TEXT, zs TEXT, src TEXT, lv TEXT);
CREATE TABLE example_entry (example INTEGER NOT NULL, entry INTEGER NOT NULL, PRIMARY KEY (entry, example)) WITHOUT ROWID;
-- 词表：name 是「分级体系:等级」（cefr:A1、cn-exam:cet4、topik:2）或「theme:主题」；rank 越小越常用
CREATE TABLE list (name TEXT NOT NULL, entry INTEGER NOT NULL, rank INTEGER, PRIMARY KEY (name, entry)) WITHOUT ROWID;
`

/** 建完数据再建的索引（先插数据再建索引快得多） */
export const INDEX_SQL = `
CREATE INDEX form_key ON form (key, loose);
CREATE INDEX form_entry ON form (entry);
CREATE INDEX entry_w ON entry (w);
CREATE INDEX entry_fr ON entry (fr);
CREATE INDEX entry_lv ON entry (lv, fr);
CREATE INDEX list_name ON list (name, rank);
`

export function packEntry(data: LexEntryData): Buffer {
  return deflateRawSync(Buffer.from(JSON.stringify(data), 'utf8'))
}

export function unpackEntry(blob: Uint8Array): LexEntryData {
  return JSON.parse(inflateRawSync(blob).toString('utf8')) as LexEntryData
}

/** 英文释义的整条键：小写、去掉开头的 to / a / an / the、括号里的补充、首尾标点 */
export function enGlossKey(gloss: string): string {
  return gloss
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/^\s*(to|a|an|the)\s+/, '')
    .replace(/[\s.,;:!?'"]+$/g, '')
    .replace(/^[\s.,;:!?'"]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 中文释义拆成几段整条键：按分号、逗号、顿号、斜线拆开，去掉括号里的补充 */
export function zhGlossKeys(gloss: string): string[] {
  return gloss
    .replace(/[（(][^）)]*[）)]/g, '')
    .split(/[；;，,、/]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length <= 16)
}
