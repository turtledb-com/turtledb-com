import { readFileSync } from 'fs'
import { question } from 'readline-sync'
import { Signer } from '../branches/cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/turtle/Signer.js'

/**
 * @typedef {{endpoint: string, region: string, bucket: string, accessKeyId: string, secretAccessKey: string}} TDBConfigS3
 * @typedef {Array.<{name: string }>} TDBConfigFsReadWrite
 * @typedef {Array.<{key: string }>} TDBConfigFsReadOnly
 * @typedef {{name: string, key: string, port: number, fallback: string, https: boolean, insecure: boolean, certpath: string}} TDBConfigWeb
 * @typedef {{host: string, port: number}} TDBConfigOrigin
 * @typedef {{port: number}} TDBConfigOutlet
 * @typedef {{
 *            username: string,
 *            password: string,
 *            archive: {path: string},
 *            interactive: boolean,
 *            s3: TDBConfigS3,
 *            fsReadWrite: TDBConfigFsReadWrite,
 *            fsReadOnly: TDBConfigFsReadOnly,
 *            fsFolder: string,
 *            web: TDBConfigWeb,
 *            origin: TDBConfigOrigin,
 *            outlet: TDBConfigOutlet
 *          }} TDBConfig
 */

/**
 * @param {Array.<any>} values
 * @returns {any}
 */
function combineValues (values) {
  if (!Array.isArray(values[0])) return values[0]
  if (values.some(value => !Array.isArray(value))) throw new Error('combine arrays with arrays only')
  return values.flat()
}

/**
 * @param {Array.<TDBConfig>} configs
 * @returns {TDBConfig}
 */
function combineConfigs (configs) {
  const keys = Array.from(configs.reduce((keysSet, config) => keysSet.union(new Set(Object.keys(config))), new Set()))
  return keys.reduce((combinedConfigs, key) => {
    const values = configs.filter(config => Object.hasOwn(config, key)).map(config => config[key])
    if (values.length) combinedConfigs[key] = combineValues(values)
    return combinedConfigs
  }, {})
}

/**
 * @returns {TDBConfig}
 */
export function getConfigFromOptions (options, overrideConfig = {}) {
  const { username, password, s3EndPoint, s3Region, s3Bucket, s3AccessKeyId, s3SecretAccessKey, disableS3, fsName, fsKey, fsFolder, webName, webKey, webPort, webFallback, originHost, originPort, outletPort, https, insecure, certpath, interactive, config: configFile, remoteConfig, archive, archivePath } = options
  /** @type {TDBConfig} */
  const defaultsConfig = configFile ? JSON.parse(readFileSync(configFile, 'utf8')) : {}
  /** @type {TDBConfig} */
  const optionsConfig = {}
  if (username) optionsConfig.username = username
  if (password) optionsConfig.password = password
  if (archive && archivePath) optionsConfig.archive = { path: archivePath }
  if (typeof interactive === 'boolean') optionsConfig.interactive = interactive
  if (!disableS3 && (s3EndPoint || s3Region || s3Bucket || s3AccessKeyId || s3SecretAccessKey)) {
    optionsConfig.s3 = {
      endpoint: s3EndPoint,
      region: s3Region,
      bucket: s3Bucket,
      accessKeyId: s3AccessKeyId,
      secretAccessKey: s3SecretAccessKey
    }
  }
  if (fsName?.length) {
    optionsConfig.fsReadWrite = fsName.map(name => ({ name }))
  }
  if (fsKey?.length) {
    optionsConfig.fsReadOnly = fsKey.map(key => ({ key }))
  }
  if (fsFolder) {
    optionsConfig.fsFolder = fsFolder
  }
  if (webPort) {
    optionsConfig.web = {
      name: webName,
      key: webKey,
      port: webPort,
      fallback: webFallback,
      https,
      insecure,
      certpath
    }
  }
  if (originHost) optionsConfig.origin = { host: originHost, port: originPort }
  if (outletPort) optionsConfig.outlet = { port: outletPort }
  const config = combineConfigs([overrideConfig, optionsConfig, defaultsConfig])
  if (config.s3 && !(config.s3.endpoint && config.s3.region && config.s3.bucket && config.s3.accessKeyId && config.s3.secretAccessKey)) {
    throw new Error('--s3-end-point, --s3-region, --s3-bucket, --s3-access-key-id, and --s3-secret-access-key must all be set to connect to s3')
  }
  if (config.fsReadWrite?.length || (config.web?.name && !config.web?.key)) {
    config.username ??= question('username: ')
    config.password ??= question('password: ', { hideEchoBack: true })
  }
  if (config.username && config.password) config.signer = new Signer(username, password)
  if (remoteConfig) {
    if (!config.signer) throw new Error('username and password must be provided to use remote-config')
    if (!config.origin && !config.s3) throw new Error('origin or s3 must be provided to use remote-config')
  }
  return config
}
