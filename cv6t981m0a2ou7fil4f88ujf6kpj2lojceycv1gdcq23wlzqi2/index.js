import { AS_REFS } from './js/turtle/codecs/CodecType.js'
import { TurtleDB } from './js/turtle/connections/TurtleDB.js'
import { Signer } from './js/turtle/Signer.js'
import { TurtleDictionary } from './js/turtle/TurtleDictionary.js'
import { Workspace } from './js/turtle/Workspace.js'
import { Recaller } from './js/utils/Recaller.js'
import { webSocketMuxFactory } from './js/utils/webSocketMuxFactory.js'

const cpk = document.baseURI.match(/(?<=\/)[0-9A-Za-z]{41,51}(?=\/)/)?.[0]
window.cpk = cpk
window.TurtleDictionary = TurtleDictionary
window.Signer = Signer
window.Workspace = Workspace
window.AS_REFS = AS_REFS

const recaller = new Recaller('web client')
const turtleDB = new TurtleDB('public/index.js', recaller)
window.turtleDB = turtleDB

webSocketMuxFactory(turtleDB, tbMux => {
  window.tbMux = tbMux
})
