import { IGNORE_ACCESS, Recaller } from '../utils/Recaller.js'
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

/**
 * @typedef PeerBranchesUpdate
 * @property {Object.<string, BranchUpdate>} publicationBranches
 * @property {Object.<string, BranchUpdate>} subscriptionBranches
 */

export class Peer {
  /** @type {Array.<Connection>} */
  connections = []

  branchesByType = {
    /** @type {Object.<string, TurtleBranch>} */
    publicationBranches: {},
    /** @type {Object.<string, TurtleBranch>} */
    subscriptionBranches: {}
  }

  /**
   * @param {string} name
   * @param {Recaller} recaller
   */
  constructor (name, recaller = new Recaller(name)) {
    this.name = name
    this.recaller = recaller

    this.recaller.watch('handle remote updates', () => {
      this.recaller.reportKeyAccess(this, 'connections', 'update', this.name)
      this.recaller.reportKeyAccess(this, 'publicationBranches', 'update', this.name)

      // apply updates from incoming
      this.connections.forEach(connection => {
        /** @type {PeerBranchesUpdate} */
        const incomingUpdate = connection.incomingUpdateBranch.lookup()
        const pubsUpdate = incomingUpdate?.publicationBranches ?? {}
        const subsUpdate = incomingUpdate?.subscriptionBranches ?? {}
        // create missing subscription branches
        for (const name in pubsUpdate) {
          if (!Object.values(this.branchesByType).some(branches => branches[name])) {
            this.branchesByType.subscriptionBranches[name] = new TurtleBranch(name, this.recaller)
          }
        }
        // append missing uint8Arrays
        for (const branches of Object.values(this.branchesByType)) {
          for (const name in branches) {
            const branch = branches[name]
            const branchUpdates = [pubsUpdate[name], subsUpdate[name]]
            for (const branchUpdate of branchUpdates) {
              while (branchUpdate?.uint8Arrays?.[(branch.height ?? -1) + 1]) {
                const address = branchUpdate.uint8Arrays[(branch.height ?? -1) + 1]
                const uint8Array = connection.incomingUpdateBranch.lookup(address)
                branch.append(uint8Array)
              }
            }
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
        /** @type {PeerBranchesUpdate} */
        const outgoingUpdate = { publicationBranches: {}, subscriptionBranches: {} }
        for (const branchType in this.branchesByType) {
          /** @type {Object.<string, TurtleBranch>} */
          const branches = this.branchesByType[branchType]
          for (const name in branches) {
            const incomingBranchUpdate = incomingUpdate?.publicationBranches?.[name] ?? incomingUpdate?.subscriptionBranches?.[name]
            if (branchType === 'publicationBranches' || incomingBranchUpdate) {
              const branch = branches[name]
              /** @type {BranchUpdate} */
              const outgoingBranchUpdate = lastOutgoingUpdate?.[branchType]?.[name] ?? {}
              outgoingBranchUpdate.height = branch.height ?? -1
              outgoingBranchUpdate.uint8Arrays ??= []
              if (incomingBranchUpdate) {
                for (let height = (incomingBranchUpdate.height ?? -1) + 1; height <= branch.height; ++height) {
                  recaller.call(() => {
                    const uint8Array = branch.u8aTurtle.findParentByHeight(height).uint8Array
                    outgoingBranchUpdate.uint8Arrays[height] ??= connection.outgoingUpdateDictionary.upsert(uint8Array)
                  }, IGNORE_ACCESS) // don't trigger ourselves
                }
              }
              outgoingUpdate[branchType][name] = outgoingBranchUpdate
            }
          }
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
      branchesByType: {
        publicationBranches: Object.fromEntries(Object.entries(this.branchesByType.publicationBranches).map(([name, branch]) => [name, branch.height])),
        subscriptionBranches: Object.fromEntries(Object.entries(this.branchesByType.subscriptionBranches).map(([name, branch]) => [name, branch.height]))
      },
      connections: this.connections.map(connection => ({
        outgoingUpdateDictionary: connection.outgoingUpdateDictionary.lookup(),
        incomingUpdateBranch: connection.incomingUpdateBranch.lookup()
      }))
    }
  }

  getRemoteBranch (name) {
    if (!this.branchesByType.subscriptionBranches[name]) {
      this.branchesByType.subscriptionBranches[name] = new TurtleBranch(name, this.recaller)
      this.recaller.reportKeyMutation(this, 'subscriptionBranches', 'getRemoteBranch', this.name)
    }
    return this.branchesByType.subscriptionBranches[name]
  }

  /**
   * @param {TurtleDictionary} turtleDictionary
   * @param {string} name
   */
  addLocalDictionary (turtleDictionary, name = turtleDictionary.name) {
    if (this.branchesByType.publicationBranches[name]) throw new Error('branch name already exists')
    this.recaller.reportKeyMutation(this, 'publicationBranches', 'addLocalDictionary', this.name)
    this.branchesByType.publicationBranches[name] = turtleDictionary
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
