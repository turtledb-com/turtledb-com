import { ASSERTION, FAIL, PASS, RUNNER, SUITE, TEST } from './TestRunnerConstants.js'
import { globalTestRunner, TestRunner, urlToName } from './TestRunner.js'

globalTestRunner.describe(urlToName(import.meta.url), suite => {
  suite.it('waits for tests to complete', async test => {
    const runner = new TestRunner()
    let _suite
    // runnerRecaller.watch('update status', () => {
    //   console.log(JSON.stringify(runner.status, undefined, 10))
    // })
    runner.describe('abc', suite => {
      _suite = suite
      suite.it('xy', async (assert) => {
        await new Promise(resolve => setTimeout(resolve, 100))
        assert.assert.equal(1, 1, '1 === 1')
        await new Promise(resolve => setTimeout(resolve, 100))
        assert.assert.equal(2, 2, '2 === 2')
      })
      suite.it('z', async (assert) => {
        await new Promise(resolve => setTimeout(resolve, 100))
        assert.assert.equal(3, 3, '3 === 3')
      })
    })

    test.assert.equal({
      name: 'unnamed-test-runner',
      type: RUNNER,
      runState: '⧖',
      children: [
        {
          name: 'abc',
          type: SUITE,
          runState: '⧖',
          children: []
        }
      ]
    }, runner.status, 'after describe')
    await runner.run()
    test.assert.equal({
      name: 'unnamed-test-runner',
      type: RUNNER,
      runState: PASS,
      children: [
        {
          name: 'abc',
          type: SUITE,
          runState: PASS,
          children: [
            {
              name: 'xy',
              type: TEST,
              runState: PASS,
              children: [
                {
                  name: '1 === 1',
                  type: ASSERTION,
                  runState: PASS,
                  children: []
                },
                {
                  name: '2 === 2',
                  type: ASSERTION,
                  runState: PASS,
                  children: []
                }
              ]
            },
            {
              name: 'z',
              type: TEST,
              runState: PASS,
              children: [
                {
                  name: '3 === 3',
                  type: ASSERTION,
                  runState: PASS,
                  children: []
                }
              ]
            }
          ]
        }
      ]
    }, runner.status, 'after run')

    _suite.it('m', async (assert) => {
      await new Promise(resolve => setTimeout(resolve, 100))
      assert.assert.equal(4, 5, '4 !== 5', false)
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    runner.describe('n', async (assert) => {
      await new Promise(resolve => setTimeout(resolve, 100))
      assert.assert.equal(5, 5, '5 === 5')
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    test.assert.equal({
      name: 'unnamed-test-runner',
      type: RUNNER,
      runState: PASS,
      children: [
        {
          name: 'abc',
          type: SUITE,
          runState: PASS,
          children: [
            {
              name: 'xy',
              type: TEST,
              runState: PASS,
              children: [
                {
                  name: '1 === 1',
                  type: ASSERTION,
                  runState: PASS,
                  children: []
                },
                {
                  name: '2 === 2',
                  type: ASSERTION,
                  runState: PASS,
                  children: []
                }
              ]
            },
            {
              name: 'z',
              type: TEST,
              runState: PASS,
              children: [
                {
                  name: '3 === 3',
                  type: ASSERTION,
                  runState: PASS,
                  children: []
                }
              ]
            },
            {
              name: 'm',
              type: TEST,
              runState: '⧖',
              children: []
            }
          ]
        },
        {
          name: 'n',
          type: SUITE,
          runState: '⧖',
          children: []
        }
      ]
    }, runner.status, 'after 2nd describe')
  })
})
