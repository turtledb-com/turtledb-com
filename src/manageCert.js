import { dirname } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { createCA, createCert } from 'mkcert'
import { logError } from '../branches/.cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/utils/logger.js'

export async function manageCert (fullcertpath) {
  try {
    mkdirSync(dirname(fullcertpath), { recursive: true })
    if (existsSync(fullcertpath)) {
      return JSON.parse(
        readFileSync(fullcertpath, {
          encoding: 'utf8'
        })
      )
    }
  } catch (error) {
    logError(() => console.error(error))
  }
  const ca = await createCA({
    organization: 'TURTLES, Turtles, turtles, etc.',
    countryCode: 'US',
    state: 'California',
    locality: 'Danville',
    validity: 365
  })
  const { key, cert } = await createCert({
    ca: {
      key: ca.key,
      cert: ca.cert
    },
    domains: ['127.0.0.1', 'localhost'],
    validity: 365
  })
  writeFileSync(fullcertpath, JSON.stringify({ key, cert }, null, 4))
  return { key, cert }
}
