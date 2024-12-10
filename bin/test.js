#!/usr/bin/env node

import chalk from 'chalk'
import { join } from 'path'
import { Committer } from '../public/js/dataModel/Committer.js'
import { watchfs } from '../src/watchfs.js'
import { hashNameAndPassword } from '../public/js/utils/crypto.js'
import { globalRunner, runnerRecaller } from '../public/test/Runner.js'

const privateKey = await hashNameAndPassword('test', 'test')
const committer = new Committer('test', privateKey, runnerRecaller) // TODO: maybe add a no-key committer for cases like this?
console.log(import.meta)
console.log(import.meta.resolve('../public'))
const root = join(import.meta.dirname, '../public')
console.log({ root })

await watchfs(committer, runnerRecaller, root, '', true)

console.log('testing go!')

await globalRunner.run()

runnerRecaller.watch('test progress', () => {
  console.log(`
    ${chalk.gray('╭───────────────────────────────────────────────────────────────╮')}\n${globalRunner.toString(chalk.gray('    │  '))}
    ${chalk.gray('╰───────────────────────────────────────────────────────────────╯')}
    `)
})

runnerRecaller.watch('test runner', async () => {
  const fsRefs = committer.getRefs('value', 'fs')
  if (fsRefs) {
    console.log(Object.keys(fsRefs).filter(path => /\.test\.js$/.test(path)))
    const paths = Object.keys(fsRefs).filter(path => /(Runner)\.test\.js$/.test(path))
    console.log({ paths })
    for (const path of paths) {
      const importPath = join('../public', path)
      await import(`${importPath}?address=${fsRefs[path]}`)
      await globalRunner.rerunChildren()
    }
  }
})
