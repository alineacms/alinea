import type {Config} from '#/core/Config.js'
import {Config as ConfigUtils} from '#/core/Config.js'
import type {Source} from '#/core/source/Source.js'
import {
  exportRuntimeDatabase,
  type RuntimeDatabaseExport
} from '../runtime/Exporter.js'

export interface BuildEntryReleaseOptions {
  releaseId: string
  configId: string
  runtime?: RuntimeDatabaseExport
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
  const generated =
    options.runtime ??
    (await exportRuntimeDatabase({
      config,
      bundleId: options.releaseId,
      bundleUrl: payloadUrl,
      source
    }))
  const runtime =
    generated.index.bundleUrl === payloadUrl
      ? generated
      : {
          ...generated,
          index: {...generated.index, bundleUrl: payloadUrl}
        }
  return {
    runtime,
    payloadPath,
    payloadUrl,
    configPath,
    configUrl
  }
}
