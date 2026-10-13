import learning from '../../../../data/sjn/learning.json'
import texts from '../../../../data/sjn/texts.json'
import { eldarinModule, type EldarinContent } from '../eldarin'
import type { LexText } from '../types'
export default eldarinModule('sjn', learning as unknown as EldarinContent, texts as LexText[])
