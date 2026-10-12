import { grammar } from '../../../src/shared/lang/ru/grammar'
console.log(
  JSON.stringify(
    grammar.filter((g) => g.examples.length < 2).map((g) => ({ id: g.id, examples: g.examples })),
    null,
    2
  )
)
