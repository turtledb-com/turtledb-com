export const FATAL = -3
export const ERROR = -2
export const WARN = -1
export const INFO = 0
export const DEBUG = 1
export let logLevel = INFO
export const setLogLevel = level => { logLevel = level }
export const log = (level, ...args) => {
  if (level > logLevel) return
  console.log(...args)
}
export const logFatal = (...args) => log(FATAL, ...args)
export const logError = (...args) => log(ERROR, ...args)
export const logWarn = (...args) => log(WARN, ...args)
export const logInfo = (...args) => log(INFO, ...args)
export const logDebug = (...args) => log(DEBUG, ...args)
