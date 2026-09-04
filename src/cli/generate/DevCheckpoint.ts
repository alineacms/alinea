import type {Config} from '#/core/Config.js'
import {isRecord} from '#/core/util/Objects.js'
import type {RuntimeDatabaseIndex} from '#/database/runtime/Model.js'
import {
  deserializeRuntimeDatabaseIndex,
  type SerializedRuntimeDatabaseIndex
} from '#/database/runtime/Serialization.js'
import fs from 'node:fs/promises'
import path from 'node:path'
import {FileRangeSource} from '#/database/replica/FileTransport.js'
import {RuntimeEntryStore} from '#/database/runtime/Store.js'
import type {DevDBCheckpoint} from './DevDB.js'
import type {GenerateContext} from './GenerateContext.js'

const parsePrefix = 'JSON.parse('

export async function loadDevCheckpoint(
  context: GenerateContext,
  config: Config,
  configHash: string
): Promise<DevDBCheckpoint | undefined> {
  const index = await readRuntimeIndex(context.bundleDir)
  if (
    !index?.source ||
    !index.development ||
    index.development.configHash !== configHash
  )
    return
  const publicDir = path.resolve(context.rootDir, config.publicDir ?? 'public')
  const pathname = new URL(index.bundleUrl, 'http://alinea.local').pathname
  const payloadFile = path.resolve(
    publicDir,
    `.${decodeURIComponent(pathname)}`
  )
  if (
    payloadFile !== publicDir &&
    !payloadFile.startsWith(`${publicDir}${path.sep}`)
  )
    return
  if (!(await exists(payloadFile))) return
  const runtime = new RuntimeEntryStore({
    index,
    source: () => new FileRangeSource(payloadFile)
  })
  return {index, payloadFile, sourceTree: (await runtime.getTree()).toJSON()}
}

async function readRuntimeIndex(
  bundleDir: string
): Promise<RuntimeDatabaseIndex | undefined> {
  let source: string
  try {
    source = await fs.readFile(path.join(bundleDir, 'runtime-index.js'), 'utf8')
  } catch {
    return
  }
  try {
    const parseStart = source.indexOf(parsePrefix)
    if (parseStart < 0 || !source.endsWith('))')) return
    const value: unknown = JSON.parse(
      JSON.parse(source.slice(parseStart + parsePrefix.length, -2)) as string
    )
    if (
      !isRecord(value) ||
      typeof value.revision !== 'string' ||
      typeof value.bundleId !== 'string' ||
      typeof value.bundleUrl !== 'string' ||
      !Array.isArray(value.entries)
    )
      return
    if (!isRecord(value.strings)) return
    return deserializeRuntimeDatabaseIndex(
      value as unknown as SerializedRuntimeDatabaseIndex
    )
  } catch {
    return
  }
}

async function exists(location: string): Promise<boolean> {
  return fs.access(location).then(
    () => true,
    () => false
  )
}
