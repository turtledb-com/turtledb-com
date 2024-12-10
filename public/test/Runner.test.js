import { ASSERTION } from './Assert.js'
import { globalRunner, RUNNER, Runner, SUITE, TEST, urlToName } from './Runner.js'

globalRunner.describe(urlToName(import.meta.url), suite => {
  suite.it('waits for tests to complete', async test => {
    const runner = new Runner()
    let _suite
    // runnerRecaller.watch('update status', () => {
    //   console.log(JSON.stringify(runner.status, undefined, 10))
    // })
    runner.describe('abc', suite => {
      _suite = suite
      suite.it('xy', async (assert) => {
        await new Promise(resolve => setTimeout(resolve, 100))
        assert.assert.equal(1, 1, '1==1')
        await new Promise(resolve => setTimeout(resolve, 100))
        assert.assert.equal(2, 2, '2==2')
      })
      suite.it('z', async (assert) => {
        await new Promise(resolve => setTimeout(resolve, 100))
        assert.assert.equal(3, 3, '3==3')
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
      runState: '✓',
      children: [
        {
          name: 'abc',
          type: SUITE,
          runState: '✓',
          children: [
            {
              name: 'xy',
              type: TEST,
              runState: '✓',
              children: [
                {
                  name: '1==1',
                  type: ASSERTION,
                  runState: '✓',
                  children: []
                },
                {
                  name: '2==2',
                  type: ASSERTION,
                  runState: '✓',
                  children: []
                }
              ]
            },
            {
              name: 'z',
              type: TEST,
              runState: '✓',
              children: [
                {
                  name: '3==3',
                  type: ASSERTION,
                  runState: '✓',
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
      assert.assert.equal(4, 5, '4!=5', false)
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    runner.describe('n', async (assert) => {
      await new Promise(resolve => setTimeout(resolve, 100))
      assert.assert.equal(5, 5, '5==5')
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    test.assert.equal({
      name: 'unnamed-test-runner',
      type: RUNNER,
      runState: '✓',
      children: [
        {
          name: 'abc',
          type: SUITE,
          runState: '✓',
          children: [
            {
              name: 'xy',
              type: TEST,
              runState: '✓',
              children: [
                {
                  name: '1==1',
                  type: ASSERTION,
                  runState: '✓',
                  children: []
                },
                {
                  name: '2==2',
                  type: ASSERTION,
                  runState: '✓',
                  children: []
                }
              ]
            },
            {
              name: 'z',
              type: TEST,
              runState: '✓',
              children: [
                {
                  name: '3==3',
                  type: ASSERTION,
                  runState: '✓',
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

    await _suite.rerunChildren()
    test.assert.equal({
      name: 'unnamed-test-runner',
      type: RUNNER,
      runState: '✖',
      children: [
        {
          name: 'abc',
          type: SUITE,
          runState: '✖',
          children: [
            {
              name: 'xy',
              type: TEST,
              runState: '✓',
              children: [
                {
                  name: '1==1',
                  type: ASSERTION,
                  runState: '✓',
                  children: []
                },
                {
                  name: '2==2',
                  type: ASSERTION,
                  runState: '✓',
                  children: []
                }
              ]
            },
            {
              name: 'z',
              type: TEST,
              runState: '✓',
              children: [
                {
                  name: '3==3',
                  type: ASSERTION,
                  runState: '✓',
                  children: []
                }
              ]
            },
            {
              name: 'm',
              type: TEST,
              runState: '✖',
              children: [
                {
                  name: '4!=5',
                  type: ASSERTION,
                  runState: '✖',
                  children: []
                }
              ]
            }
          ]
        },
        {
          name: 'n',
          type: SUITE,
          runState: '✓',
          children: [
            {
              name: '5==5',
              type: ASSERTION,
              runState: '✓',
              children: []
            }
          ]
        }
      ]
    }, runner.status, 'after rerunChildren')
  })
})
