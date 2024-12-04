import { defaultCPK } from '../js/constants.js'
import { h } from '../js/display/h.js'
import { render } from '../js/display/render.js'
import { getPointerByPublicKey, peerRecaller } from '../js/net/Peer.js'
import { connectPeer } from '../js/utils/connectPeer.js'

import * as chai from './chai.js'

window.chai = chai

const pointer = getPointerByPublicKey(defaultCPK)
connectPeer(peerRecaller).catch(err => {
  console.log(err)
})
console.log('asdf')

const tests = () => {
  console.log(pointer)
  try {
    const fs = pointer.getRefs('value', 'fs')
    if (!fs) throw new Error('no value.fs found')
    const tests = Object.keys(fs).filter(name => name.match(/\.test\.js$/))
    console.log(tests)
    let counter = 0
    const onload = el => e => {
      console.log(counter++)
      if (counter === tests.length) mocha.run()
    }
    return h`
      <script type="module" key="mocha-init.${pointer.layerIndex}">
        console.log('tests to follow')
        mocha.setup('bdd')
        mocha.checkLeaks()
      </script>
      ${tests.map(test => h`<script type="module" src="/${test}" key="${test}" onload=${onload}></script>`)}
    `
    /*
    const testScripts = [
      h`<div id="mocha"></div>`,
      h`<script class="mocha-init">
        mocha.setup('bdd')
        mocha.checkLeaks()
      </script>`,
      ...tests.map(test => h`<script type="module" src="/${test}"></script>`),
      h`<script type="module" class="mocha-exec">
        console.log(mocha)
        setTimeout(() => {
          console.log('about to run')
          mocha.run()
          console.log('just ran')
        }, 1000)
      </script>`
    ]
    return testScripts
    */
  } catch (error) {
    console.error(error)
    return '// loading...'
  }
}

render(document.body, h`
  <div id="mocha"></div>
  ${tests}
`, pointer.recaller, 'test/index.js')
