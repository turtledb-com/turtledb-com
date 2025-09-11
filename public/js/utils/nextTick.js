import { logError, logInfo } from './logger.js'

let _tickCount = 0
let _nextTick
if (typeof setTimeout !== 'undefined') {
  _nextTick = setTimeout
}
if (typeof process !== 'undefined') {
  _nextTick = process.nextTick
}

let _functions = []
let _handlingTriggered = false

export const nextTick = f => {
  _functions.push(f)
  if (_handlingTriggered) return
  _handlingTriggered = true
  _nextTick(() => handleNextTick())
}

export const handleNextTick = (decorate = false) => {
  ++_tickCount
  if (decorate) logInfo(() => console.log(`👇👇👇👇👇👇👇👇👇👇 --- _tickCount: ${_tickCount} ---\n\n`))
  for (let i = 0; i < 10; ++i) {
    _handlingTriggered = false
    const __functions = _functions
    _functions = []
    __functions.forEach(f => f())
    if (!_functions.length) {
      if (decorate) logInfo(() => console.log('\n\n👆👆👆👆👆👆👆👆👆👆 ---'))
      return
    }
    if (decorate) logInfo(() => console.log(`\n\n🤔🤔🤔🤔🤔🤔🤔🤔🤔🤔 --- _tickCount: ${_tickCount} loop: ${i} ---\n\n`))
  }
  _tickCount = Math.ceil(_tickCount)
  logError(() => console.error('handleNextTick adding nextTick handler too many times'))
}

export const getTickCount = () => _tickCount

export const tics = async (count = 1, ticLabel = '') => {
  for (let i = 0; i < count; ++i) {
    if (ticLabel) logInfo(() => console.log(`${ticLabel}, tic: ${i}`))
    await new Promise(resolve => setTimeout(resolve))
  }
}
