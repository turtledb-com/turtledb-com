import { logError, logInfo, logWarn } from './logger.js'
import { NestedSet } from './NestedSet.js'
import { nextTick, getTickCount } from './nextTick.js'

let _debug = false
export const setDebug = (debug = true) => {
  _debug = debug
}

export const IGNORE_ACCESS = Symbol('IGNORE_ACCESS')
export const IGNORE_MUTATE = Symbol('IGNORE_MUTATE')
export const IGNORE = Symbol('IGNORE')

const invert = msg => `\x1b[7m${msg}\x1b[0m`

export class Recaller {
  name
  #mms = new NestedSet()
  #functionNames = new Map()
  #stack = []
  #triggered = new Set()
  #handlingTriggered = false
  #beforeTriggered = []
  #afterTriggered = []
  /** @type {boolean} */
  #debug
  #ignore = null
  loopWarn = 2
  loopLimit = 10

  constructor (name) {
    if (!name) throw new Error('Recaller must be named')
    this.name = name
  }

  set debug (debug) {
    this.#debug = debug
  }

  get debug () {
    return this.#debug ?? _debug
  }

  call (f, ignore = null) {
    if (typeof f !== 'function') throw new Error('can only hide functions')
    const previousIgnore = this.#ignore
    this.#ignore = ignore
    const v = f(this)
    this.#ignore = previousIgnore
    return v
  }

  watch (name, f) {
    if (!name || typeof name !== 'string') throw new Error('please name watches')
    if (typeof f !== 'function') { throw new Error(`can only watch functions (${name})`) }
    this.#disassociateF(f)
    if (!name) throw new Error('must name function watchers')
    this.#nameFunction(f, name)
    if (this.debug) logInfo(() => console.group(`${invert('<==  watching')}: ${JSON.stringify(name)}`))
    this.#stack.unshift(f)
    try {
      f(this)
    } catch (error) {
      logError(() => console.error(error))
    }
    this.#stack.shift()
    if (this.debug) logInfo(() => console.groupEnd())
  }

  unwatch (f) {
    this.#disassociateF(f)
  }

  beforeNextUpdate (f) {
    if (!this.#beforeTriggered.includes(f)) this.#beforeTriggered.push(f)
  }

  afterNextUpdate (f) {
    if (!this.#afterTriggered.includes(f)) this.#afterTriggered.push(f)
  }

  reportKeyAccess (target, key, method, name) {
    if (this.#ignore === IGNORE || this.#ignore === IGNORE_ACCESS) return
    const f = this.#stack[0]
    if (typeof f !== 'function') return
    name = `${name}['${key.toString()}']`
    if (this.debug) {
      const triggering = this.#getFunctionName(f)
      logInfo(() => console.debug(
        `${invert('<--  access')}: ${JSON.stringify({ recaller: this.name, method, name, triggering })}`
      ))
    }
    this.#associate(f, target, key)
  }

  reportKeyMutation (target, key, method, name) {
    if (this.#ignore === IGNORE || this.#ignore === IGNORE_MUTATE) return
    const newTriggered = this.#getFunctions(target, key)
    if (!newTriggered.length) return
    name = `${name}['${key.toString()}']`
    if (this.debug) {
      const triggering = newTriggered.map(f => this.#getFunctionName(f))
      logInfo(() => console.debug(
        `${invert('-->  mutation')}: ${JSON.stringify({ recaller: this.name, method, name, triggering })}`
      ))
    }
    if (name.match(/\['name'\]\['name'\]/)) throw new Error('double name')
    this.#triggered = new Set([...this.#triggered, ...newTriggered])
    if (this.#handlingTriggered) return
    this.#handlingTriggered = true
    nextTick(() => this.#handleTriggered())
  }

  #associate (f, target, key) {
    this.#mms.add(key, target, f)
    this.#mms.add(f, target, key)
  }

  #disassociateF (f) {
    this.#mms.delete(f)
    this.#functionNames.delete(f)
  }

  #getFunctions (target, key) {
    return this.#mms.values(key, target)
  }

  // debugging functions
  #nameFunction (f, name) {
    this.#functionNames.set(f, name)
  }

  #getFunctionName (f) {
    return this.#functionNames.get(f) || f.name || `<<UNNAMED FUNCTION[${f.toString()}]>>`
  }

  #handleTriggered () {
    const beforeTriggered = [...this.#beforeTriggered]
    this.#beforeTriggered = []
    beforeTriggered.forEach(f => f())
    let loopCounter = 0
    while ((this.#triggered.size || this.#afterTriggered.length)) {
      if (loopCounter >= this.loopLimit) {
        logError(() => console.error(`!! Recaller limit check ERROR; loop count: ${loopCounter}, loop limit: ${this.loopLimit}`))
        break
      }
      if (loopCounter >= this.loopWarn) {
        logWarn(() => console.warn(`!! Recaller loop count: ${loopCounter}`))
      }
      const triggered = this.#triggered
      this.#triggered = new Set()
      if (this.debug) {
        const triggering = [...triggered].map(f => this.#getFunctionName(f))
        logInfo(() => console.time(invert('===  handling triggered group')))
        logInfo(() => console.groupCollapsed(
          `${invert('==>  triggering')}: ${JSON.stringify({ recaller: this.name, tickCount: getTickCount(), loopCounter, triggering })}`
        ))
      }
      triggered.forEach(f => {
        const name = this.#getFunctionName(f)
        this.#disassociateF(f)
        this.watch(name, f)
      })
      while (this.#afterTriggered.length) {
        this.#afterTriggered.shift()()
      }
      ++loopCounter
      if (this.debug) {
        logInfo(() => console.groupEnd())
        logInfo(() => console.timeEnd(invert('===  handling triggered group')))
      }
    }
    this.#handlingTriggered = false
  }
}
