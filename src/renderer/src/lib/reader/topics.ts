/**
 * 文章的主题：内置文章写的是代号（story、poem、folktale），按界面语言翻；
 * NHK 新闻的分类（社会、スポーツ……）与自己填的主题原样显示。
 */
import { t } from '$lib/i18n/index.svelte'

const CODES = new Set(['story', 'poem', 'folktale'])

export const topicLabel = (topic: string | undefined): string =>
  !topic ? '' : CODES.has(topic) ? t(`reading.topics.${topic}`) : topic
