import type {Config} from '#/core/Config.js'
import {Config as ConfigUtils} from '#/core/Config.js'
import type {Source} from '#/core/source/Source.js'
import type {DatabaseSnapshot} from '../Database.js'
import type {AlineaDatabaseRecord} from '../entry/Model.js'
import {buildEntryDatabase} from '../entry/Source.js'
import {
  exportRuntimeDatabase,
  type RuntimeDatabaseExport
} from '../runtime/Exporter.js'

export interface BuildEntryReleaseOptions {
  releaseId: string
  configId: string
  snapshot?: DatabaseSnapshot<AlineaDatabaseRecord>
}

export interface EntryReleaseArtifacts {
  runtime: RuntimeDatabaseExport
  payloadPath: string
  payloadUrl: string
  configPath: string
  configUrl: string
}

export async function buildEntryReleaseArtifacts(
  config: Config,
  source: Source,
  options: BuildEntryReleaseOptions
): Promise<EntryReleaseArtifacts> {
  const adminPath = ConfigUtils.adminPath(config).replace(/^\/+|\/+$/g, '')
  const payloadPath = `${adminPath}/${options.releaseId}`
  const payloadUrl = `/${payloadPath}/payload.bundle`
  const configPath = `${adminPath}/config/${options.configId}`
  const configUrl = `/${configPath}/client-config.js`
  const snapshot =
    options.snapshot ?? (await buildEntryDatabase(config, source))
  const runtime = await exportRuntimeDatabase({
    bundleId: options.releaseId,
    bundleUrl: payloadUrl,
    snapshot,
    source
  })
  return {
    runtime,
    payloadPath,
    payloadUrl,
    configPath,
    configUrl
  }
}
