import type {Config} from '#/core/Config.js'
import {FileRangeSource} from '#/database/replica/FileTransport.js'
import {RuntimeEntryStore} from '#/database/runtime/Store.js'
import {SourceDB} from '#/database/entry/SourceDB.js'
import {generatedRuntimeIndex} from '#/backend/store/GeneratedRuntime.js'
import path from 'node:path'
import {generatedEnvironment} from './GeneratedEnvironment.js'

export function createGeneratedRuntimeDB(config: Config): SourceDB {
  const environment = generatedEnvironment()
  if (
    environment.releaseId !== generatedRuntimeIndex.bundleId ||
    environment.releaseUrl !== generatedRuntimeIndex.bundleUrl
  ) {
    throw new Error(
      "Alinea's generated runtime index does not match the configured release. Run the Alinea build again and ensure next.config is wrapped with withAlinea."
    )
  }
  const publicDir = path.resolve(process.cwd(), config.publicDir ?? 'public')
  const store = new RuntimeEntryStore({
    index: generatedRuntimeIndex,
    source(url) {
      const pathname = new URL(url, 'http://alinea.local').pathname
      const location = path.resolve(
        publicDir,
        `.${decodeURIComponent(pathname)}`
      )
      if (
        location !== publicDir &&
        !location.startsWith(`${publicDir}${path.sep}`)
      )
        throw new Error(`Payload path escapes public directory: ${pathname}`)
      return new FileRangeSource(location)
    }
  })
  return new SourceDB(config, store)
}
