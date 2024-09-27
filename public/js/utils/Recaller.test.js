import { Recaller } from './Recaller.js'
import { handleNextTick } from './nextTick.js'

const { default: chai } = await import('./chaiPromise.test.js')

describe('Recaller', function () {
  it('calls watched functions when accessed values change', function () {
    const recaller = new Recaller('calls watched functions')
    const a = {}
    const b = {}
    let counter = 0
    recaller.watch('count on access', function () {
      ++counter
      recaller.reportKeyAccess(a, 'x')
      recaller.reportKeyAccess(b, 'y')
    })
    chai.assert.equal(counter, 1, 'function should get called at start')

    recaller.reportKeyMutation(a, 'x')
    recaller.reportKeyMutation(a, 'x')
    recaller.reportKeyMutation(b, 'y')
    handleNextTick()
    chai.assert.equal(counter, 2, 'function should get called once per tic')

    recaller.reportKeyMutation(a, 'y')
    recaller.reportKeyMutation(a, 'y')
    recaller.reportKeyMutation(b, 'x')
    handleNextTick()
    chai.assert.equal(counter, 2, 'function should not get called when unaccessed values change')
  })

  it('calls beforeNextUpdate and afterNextUpdate functions in order', function () {
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
    chai.assert.equal(output, 'w', 'called at start')
    handleNextTick()
    chai.assert.equal(output, 'w', 'nothing triggered')
    recaller.reportKeyMutation(o, 'x')
    chai.assert.equal(output, 'w', 'still nothing triggered')
    handleNextTick()
    chai.assert.equal(output, 'wbwa', 'everything triggered in order')
  })

  it('skips replaced triggers', function () {
    const recaller = new Recaller('skips replaced triggers')
    let callCount = 0
    const watchedFunction = () => {
      recaller.reportKeyMutation(recaller, 'key', 'test', 'test')
      recaller.reportKeyAccess(recaller, 'key', 'test', 'test')
      ++callCount
    }
    recaller.watch('watchedFunction', watchedFunction)
    chai.assert.equal(callCount, 1)
    handleNextTick()
    chai.assert.equal(callCount, 1)
    recaller.reportKeyMutation(recaller, 'key', 'test', 'test')
    chai.assert.equal(callCount, 1)
    handleNextTick()
    chai.assert.equal(callCount, 2)
    recaller.watch('watchedFunction', watchedFunction)
    chai.assert.equal(callCount, 3)
    handleNextTick()
    chai.assert.equal(callCount, 3)
  })
})
