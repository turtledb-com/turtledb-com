#!/usr/bin/env node

import runAll from 'npm-run-all'

import { ListBucketsCommand, S3Client } from '@aws-sdk/client-s3'
import { readFileSync } from 'fs'
import { join } from 'path'

export const cwd = process.cwd()

const args = process.argv.slice(2)
const config = JSON.parse(readFileSync(join(cwd, args[0]), { encoding: 'utf8' }))
config.S3ClientConfig.credentials.secretAccessKey = process.env[config.S3ClientConfig.credentials.accessKeyId]
console.log('config.name:', config.name)

const s3Client = new S3Client(config.S3ClientConfig)
const command = new ListBucketsCommand({})
const response = await s3Client.send(command)
console.log(response)
