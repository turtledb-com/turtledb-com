import { Recaller } from './Recaller.js'
import { globalTestRunner, urlToName } from './TestRunner.js'
import { handleNextTick } from './nextTick.js'

globalTestRunner.describe(urlToName(import.meta.url), suite => {
  suite.it('calls watched functions when accessed values change', ({ assert }) => {
    const recaller = new Recaller('calls watched functions')
    const a = {}
    const b = {}
    let counter = 0
    recaller.watch('count on access', function () {
      ++counter
      recaller.reportKeyAccess(a, 'x')
      recaller.reportKeyAccess(b, 'y')
    })
    assert.equal(counter, 1, 'function should get called at start')

    recaller.reportKeyMutation(a, 'x')
    recaller.reportKeyMutation(a, 'x')
    recaller.reportKeyMutation(b, 'y')
    handleNextTick()
    assert.equal(counter, 2, 'function should get called once per tic')

    recaller.reportKeyMutation(a, 'y')
    recaller.reportKeyMutation(a, 'y')
    recaller.reportKeyMutation(b, 'x')
    handleNextTick()
    assert.equal(counter, 2, 'function should not get called when unaccessed values change')
  })

  suite.it('calls beforeNextUpdate and afterNextUpdate functions in order', ({ assert }) => {
    const recaller = new Recaller('calls beforeNextUpdate and afterNextUpdate')
    const o = {}
    let output = ''
    recaller.beforeNextUpdate(() => {
      output = output + 'b'
    })
    recaller.afterNextUpdate(() => {
      output = output + 'a'
    })
    recaller.watch('o.x', () => {
      recaller.reportKeyAccess(o, 'x')
      output = output + 'w'
    })
    assert.equal(output, 'w', 'called at start')
    handleNextTick()
    assert.equal(output, 'w', 'nothing triggered')
    recaller.reportKeyMutation(o, 'x')
    assert.equal(output, 'w', 'still nothing triggered')
    handleNextTick()
    assert.equal(output, 'wbwa', 'everything triggered in order')
  })

  suite.it('skips replaced triggers', ({ assert }) => {
    const recaller = new Recaller('skips replaced triggers')
    let callCount = 0
    const watchedFunction = () => {
      recaller.reportKeyMutation(recaller, 'key', 'test', 'test')
      recaller.reportKeyAccess(recaller, 'key', 'test', 'test')
      ++callCount
    }
    recaller.watch('watchedFunction', watchedFunction)
    assert.equal(callCount, 1)
    handleNextTick()
    assert.equal(callCount, 1)
    recaller.reportKeyMutation(recaller, 'key', 'test', 'test')
    assert.equal(callCount, 1)
    handleNextTick()
    assert.equal(callCount, 2)
    recaller.watch('watchedFunction', watchedFunction)
    assert.equal(callCount, 3)
    handleNextTick()
    assert.equal(callCount, 3)
  })
})
