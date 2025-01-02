import { globalRunner, urlToName } from '../../test/Runner.js'

globalRunner.describe(urlToName(import.meta.url), suite => {
  suite.it('encodes and decodes', ({ assert }) => {
  })
})
