#!/usr/bin/env node

import chalk from 'chalk'
import { join } from 'path'
import { Committer } from '../public/js/dataModel/Committer.js'
import { watchfs } from '../src/watchfs.js'
import { hashNameAndPassword } from '../public/js/utils/crypto.js'
import { globalRunner, runnerRecaller, urlToName } from '../public/test/Runner.js'
import { TEST, SUITE, RUNNER, RUNNING, WAIT, PASS, FAIL } from '../public/test/constants.js'
import { program } from 'commander'

program
  .name('test')
  .option('-w --watch', 'watch updates')
  .parse()

const { watch } = program.opts()

console.log(watch)

const runnerToString = (runner = globalRunner, indent = '', isLastChild = true) => {
  const collapsed = runner.type === TEST && runner.runState === PASS
  const hasChildren = !collapsed && runner.children.length
  const pipes = `${isLastChild ? '╰' : '├'}─${hasChildren ? '┬' : '─'}─╴`
  const childIndent = `${indent}${isLastChild ? ' ' : '│'} `
  let runState = runner.runState
  let name = runner.name
  let type = runner.type

  if (runner.type === RUNNER) {
    name = chalk.underline(name)
  } else if (runner.type === SUITE) {
    // name = chalk.bold(name)
  } else if (runner.type !== TEST) {
    name = chalk.italic(name)
  }
  switch (runner.runState) {
    case FAIL:
      runState = chalk.red(runState)
      name = chalk.red(name)
      type = chalk.red(type)
      break
    case PASS:
      runState = chalk.green(runState)
      // name = chalk.black(name)
      type = chalk.green(type)
      break
    case RUNNING:
      runState = chalk.green(runState)
      name = chalk.green(name)
      type = chalk.dim(type)
      break
    case WAIT:
      runState = chalk.green(runState)
      name = chalk.dim(name)
      type = chalk.dim(type)
      break
    default:
      runState = chalk.magenta(runState)
      name = chalk.dim(name)
      type = chalk.magenta(type)
  }

  const header = `${indent}${pipes}${type} ${runState} ${name}`
  let lines
  let children = []
  if (hasChildren) {
    children = runner.children.map((child, index) => runnerToString(child, childIndent, index === runner.children.length - 1))
  }
  if (runner.type === RUNNER) {
    lines = [`${indent}╷`, header, ...children]
  } else if (runner.type === SUITE) {
    lines = [`${indent}╷`, header, ...children]
  } else {
    lines = [header, ...children]
  }
  return lines.join('\n')
}

const privateKey = await hashNameAndPassword('test', 'test')
const committer = new Committer('test', privateKey, runnerRecaller) // TODO: maybe add a no-key committer for cases like this?
const root = join(import.meta.dirname, '../public')

await watchfs(committer, runnerRecaller, root, '', true)

console.log('begin testing!')

await globalRunner.run()

const frameStatus = () => {
  console.log('testing results:', new Date())
  console.log(`
    ${chalk.gray(`╭${'─'.repeat(70)}╮`)}\n${runnerToString(globalRunner, chalk.gray('    │  '))}
    ${chalk.gray(`╰${'─'.repeat(70)}╯`)}
  `)
}

if (watch) {
  runnerRecaller.watch('test progress', frameStatus)
}

runnerRecaller.watch('test runner', async () => {
  const fsRefs = committer.getRefs('value', 'fs')
  if (fsRefs) {
    const paths = Object.keys(fsRefs).filter(path => /\.test\.js$/.test(path))
    await Promise.all(paths.map(async path => {
      const importPath = `${join('../public', path)}?address=${fsRefs[path]}`
      try {
        await import(importPath)
      } catch (error) {
        globalRunner.describe(urlToName(importPath), suite => {
          suite.it(`import error: ${error.message}`, () => { throw error })
        })
        console.error(error)
      }
    }))
    await globalRunner.rerunChildren()
    if (!watch) {
      frameStatus()
      if (globalRunner.runState === PASS) process.exit(0)
      else process.exit(1)
    }
  }
})
