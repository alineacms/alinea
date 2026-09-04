import {generatedRuntimeIndex} from '#/backend/store/GeneratedRuntime.js'
import {Config, type Config as ConfigDefinition} from '#/core/Config.js'
import {SourceDB} from '#/database/entry/SourceDB.js'
import {FileRangeSource} from '#/database/replica/FileTransport.js'
import {HttpRangeSource} from '#/database/replica/HttpTransport.js'
import type {RuntimeDatabaseIndex} from '#/database/runtime/Model.js'
import {RuntimeEntryStore} from '#/database/runtime/Store.js'
import {
  generatedEnvironment,
  type GeneratedEnvironment
} from './GeneratedEnvironment.js'
import path from 'node:path'

interface CreateGeneratedRuntimeDBOptions {
  environment?: GeneratedEnvironment
  index?: RuntimeDatabaseIndex
  fetch?: typeof globalThis.fetch
  nodeEnv?: string
  productionBuild?: boolean
}

export function createGeneratedRuntimeDB(
  config: ConfigDefinition,
  options: CreateGeneratedRuntimeDBOptions = {}
): SourceDB {
  const environment = options.environment ?? generatedEnvironment()
  const index = options.index ?? generatedRuntimeIndex
  if (environment.releaseUrl !== index.bundleUrl) {
    throw new Error(
      "Alinea's generated runtime index does not match the configured release. Run the Alinea build again and ensure next.config is wrapped with withAlinea."
    )
  }
  const baseUrl = Config.baseUrl(config, options.nodeEnv)
  if (!options.productionBuild && !baseUrl)
    throw new Error(
      'Alinea requires a baseUrl to read its generated payload at runtime.'
    )
  const publicDir = path.resolve(process.cwd(), config.publicDir ?? 'public')
  const pathname = new URL(environment.releaseUrl, 'http://alinea.local')
    .pathname
  const payloadFile = path.resolve(
    publicDir,
    `.${decodeURIComponent(pathname)}`
  )
  if (
    options.productionBuild &&
    payloadFile !== publicDir &&
    !payloadFile.startsWith(`${publicDir}${path.sep}`)
  )
    throw new Error(`Payload path escapes public directory: ${pathname}`)
  const store = new RuntimeEntryStore({
    index,
    source: url =>
      options.productionBuild
        ? new FileRangeSource(payloadFile)
        : new HttpRangeSource(
            new URL(url, baseUrl),
            options.fetch ?? globalThis.fetch
          )
  })
  return new SourceDB(config, store)
}
