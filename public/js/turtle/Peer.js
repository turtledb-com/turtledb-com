import { IGNORE_ACCESS, Recaller } from '../utils/Recaller.js'
import { codec, OPAQUE_UINT8ARRAY } from './codecs/codec.js'
import { TurtleBranch } from './TurtleBranch.js'
import { TurtleDictionary } from './TurtleDictionary.js'

/**
 * @typedef Duplex
 * @property {ReadableStream} readableStream
 * @property {WritableStream} writableStream
 */

/**
 * @typedef Connection
 * @property {Duplex} duplex
 * @property {TurtleDictionary} outgoingUpdateDictionary
 * @property {TurtleBranch} incomingUpdateBranch
 */

/**
 * @typedef BranchUpdate
 * @property {number} height
 * @property {Array.<number>} uint8Arrays
 */

export class Peer {
  /** @type {Array.<Connection>} */
  connections = []

  /** @type {Object.<string, TurtleBranch>} */
  branches = {}

  /**
   * @param {string} name
   * @param {Recaller} recaller
   */
  constructor (name, recaller = new Recaller(name)) {
    this.name = name
    this.recaller = recaller

    this.recaller.watch('handle remote updates', () => {
      this.recaller.reportKeyAccess(this, 'connections', 'update', this.name)
      this.recaller.reportKeyAccess(this, 'branches', 'update', this.name)

      // apply updates from incoming
      this.connections.forEach(connection => {
        /** @type {PeerBranchesUpdate} */
        const incomingUpdate = connection.incomingUpdateBranch.lookup()
        const update = incomingUpdate ?? {}
        // create missing subscription branches
        for (const name in update) {
          if (!this.branches[name]) {
            this.branches[name] = new TurtleBranch(name, this.recaller)
          }
        }
        // append missing uint8Arrays
        for (const name in this.branches) {
          const branch = this.branches[name]
          const branchUpdate = update[name]
          while (branchUpdate?.uint8Arrays?.[(branch.height ?? -1) + 1]) {
            const address = branchUpdate.uint8Arrays[(branch.height ?? -1) + 1]
            const uint8Array = connection.incomingUpdateBranch.lookup(address)
            branch.append(uint8Array)
          }
        }
      })
      // prepare updates for outgoing
      this.connections.forEach(connection => {
        /** @type {PeerBranchesUpdate} */
        const incomingUpdate = connection.incomingUpdateBranch.lookup()
        /** @type {PeerBranchesUpdate} */
        let lastOutgoingUpdate
        this.recaller.call(() => {
          lastOutgoingUpdate = connection.outgoingUpdateDictionary.lookup()
        })
        /** @type {Object.<string, BranchUpdate>} */
        const outgoingUpdate = {}
        for (const name in this.branches) {
          const incomingBranchUpdate = incomingUpdate?.[name]
          const branch = this.branches[name]
          /** @type {BranchUpdate} */
          const outgoingBranchUpdate = lastOutgoingUpdate?.[name] ?? {}
          outgoingBranchUpdate.height = branch.height ?? -1
          outgoingBranchUpdate.uint8Arrays ??= []
          if (incomingBranchUpdate) {
            for (let height = (incomingBranchUpdate.height ?? -1) + 1; height <= branch.height; ++height) {
              recaller.call(() => {
                const uint8Array = branch.u8aTurtle.findParentByHeight(height).uint8Array
                outgoingBranchUpdate.uint8Arrays[height] ??= connection.outgoingUpdateDictionary.upsert(uint8Array, [codec.getCodecType(OPAQUE_UINT8ARRAY)])
              }, IGNORE_ACCESS) // don't trigger ourselves
            }
          }
          outgoingUpdate[name] = outgoingBranchUpdate
        }
        this.recaller.call(() => {
          connection.outgoingUpdateDictionary.upsert(outgoingUpdate)
        }, IGNORE_ACCESS) // don't trigger ourselves
      })
    })
  }

  summary () {
    return {
      name: this.name,
      branches: Object.fromEntries(Object.entries(this.branches).map(([name, branch]) => [name, branch.height])),
      connections: this.connections.map(connection => ({
        outgoingUpdateDictionary: connection.outgoingUpdateDictionary.lookup(),
        incomingUpdateBranch: connection.incomingUpdateBranch.lookup()
      }))
    }
  }

  /**
   * @param {string} name
   * @param {string} [bale=name]
   * @param {string} [hostname='turtledb.com']
   * @returns {TurtleBranch}
   */
  getBranch (name, bale = name, hostname = 'turtledb.com') {
    const branchName = `${hostname}-${bale}-${name}`
    if (!this.branches[branchName]) {
      this.branches[branchName] = new TurtleBranch(branchName, this.recaller)
      this.recaller.reportKeyMutation(this, 'branches', 'getBranch', this.name)
    }
    return this.branches[branchName]
  }

  /**
   * @returns {Duplex}
   */
  makeConnection () {
    const index = this.connections.length
    const outgoingUpdateDictionary = new TurtleDictionary(`${this.name}.connections.${index}.outgoingUpdateDictionary`, this.recaller)
    const incomingUpdateBranch = new TurtleBranch(`${this.name}.connections.${index}.incomingUpdateBranch`, this.recaller)
    const connection = { readableStream: outgoingUpdateDictionary.makeReadableStream(), writableStream: incomingUpdateBranch.makeWritableStream() }
    this.connections.push({ outgoingUpdateDictionary, incomingUpdateBranch, connection })
    this.recaller.reportKeyMutation(this, 'connections', 'makeConnection', this.name)
    return connection
  }

  /**
   * @param {Duplex} duplex
   */
  connect (duplex) {
    const index = this.connections.length
    const outgoingUpdateDictionary = new TurtleDictionary(`${this.name}.connections[${index}].outgoingUpdateDictionary`, this.recaller)
    const incomingUpdateBranch = new TurtleBranch(`${this.name}.connections[${index}].incomingUpdateBranch`, this.recaller)
    this.connections[index] = { outgoingUpdateDictionary, incomingUpdateBranch, duplex }
    this.recaller.reportKeyMutation(this, 'connections', 'connect', this.name)
    duplex.readableStream.pipeTo(incomingUpdateBranch.makeWritableStream())
    outgoingUpdateDictionary.makeReadableStream().pipeTo(duplex.writableStream)
  }
}
