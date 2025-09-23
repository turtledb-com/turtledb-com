export const OFF = Number.NEGATIVE_INFINITY
export const FATAL = -3
export const ERROR = -2
export const WARN = -1
export const INFO = 0
export const DEBUG = 1
export const TRACE = 2
export const SILLY = 3
export const ALL = Number.POSITIVE_INFINITY
export let logLevel = INFO
export const LOG_LEVELS = { OFF, FATAL, ERROR, WARN, INFO, DEBUG, TRACE, SILLY, ALL }
export const setLogLevel = level => { logLevel = level }
export const log = (level, ...args) => {
  if (level > +logLevel) return
  if (args.length === 1 && typeof args[0] === 'function') args[0]()
  else console.log(...args)
}
export const logFatal = (...args) => log(FATAL, ...args)
export const logError = (...args) => log(ERROR, ...args)
export const logWarn = (...args) => log(WARN, ...args)
export const logInfo = (...args) => log(INFO, ...args)
export const logDebug = (...args) => log(DEBUG, ...args)
export const logTrace = (...args) => log(TRACE, ...args)
export const logSilly = (...args) => log(SILLY, ...args)
