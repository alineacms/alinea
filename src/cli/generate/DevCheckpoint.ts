import type {Config} from '#/core/Config.js'
import {isRecord} from '#/core/util/Objects.js'
import type {RuntimeDatabaseIndex} from '#/database/runtime/Model.js'
import fs from 'node:fs/promises'
import path from 'node:path'
import type {DevDBCheckpoint} from './DevDB.js'
import type {GenerateContext} from './GenerateContext.js'

const modulePrefix = 'export default '

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
  return {index, payloadFile}
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
  if (!source.startsWith(modulePrefix)) return
  try {
    const value: unknown = JSON.parse(source.slice(modulePrefix.length))
    if (
      !isRecord(value) ||
      value.version !== 1 ||
      typeof value.revision !== 'string' ||
      typeof value.bundleId !== 'string' ||
      typeof value.bundleUrl !== 'string' ||
      !Array.isArray(value.entries) ||
      !isRecord(value.children)
    )
      return
    return value as unknown as RuntimeDatabaseIndex
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
