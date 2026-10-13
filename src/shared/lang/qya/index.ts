import learning from '../../../../data/qya/learning.json'
import texts from '../../../../data/qya/texts.json'
import { eldarinModule, type EldarinContent } from '../eldarin'
import type { LexText } from '../types'
export default eldarinModule('qya', learning as unknown as EldarinContent, texts as LexText[])
