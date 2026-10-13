/** 下载仅获取模型；文字和录音在本机合成，不发送到语音服务。 */
export interface NeuralStatus {
  supported: boolean
  installed: boolean
  downloading: boolean
  received: number
  total: number
  error?: string
}

/** 此模型按文字学习，不能作为通用 IPA 引擎。 */
export const NEURAL_LANGUAGES = [
  'en',
  'ko',
  'ja',
  'ar',
  'bg',
  'cs',
  'da',
  'de',
  'el',
  'es',
  'et',
  'fi',
  'fr',
  'hi',
  'hr',
  'hu',
  'id',
  'it',
  'lt',
  'lv',
  'nl',
  'pl',
  'pt',
  'ro',
  'ru',
  'sk',
  'sl',
  'sv',
  'tr',
  'uk',
  'vi'
] as const
export const NEURAL_STYLES = ['F1', 'F2', 'M1', 'M2'] as const
export function neuralVoice(name: string): { lang: string; style: string } | null {
  const parts = /^neural:supertonic3:([a-z]{2}):(F1|F2|M1|M2)$/.exec(name)
  return parts && (NEURAL_LANGUAGES as readonly string[]).includes(parts[1])
    ? { lang: parts[1], style: parts[2] }
    : null
}
