import type {Config} from '#/core/Config.js'
import {Config as ConfigUtils} from '#/core/Config.js'
import type {Source} from '#/core/source/Source.js'
import {buildEntryDatabase} from '../entry/Source.js'
import {
  serializeHandlerKeys,
  serializeReplicaCatalog
} from '../replica/Serialization.js'
import {exportEntryRelease, type ReleaseExport} from './Exporter.js'

export interface BuildEntryReleaseOptions {
  releaseId: string
  configId: string
}

export interface EntryReleaseArtifacts {
  release: ReleaseExport
  releasePath: string
  releaseUrl: string
  configPath: string
  configUrl: string
  catalogJson: string
  handlerKeysJson: string
}

export async function buildEntryReleaseArtifacts(
  config: Config,
  source: Source,
  options: BuildEntryReleaseOptions
): Promise<EntryReleaseArtifacts> {
  const adminPath = ConfigUtils.adminPath(config).replace(/^\/+|\/+$/g, '')
  const releasePath = `${adminPath}/release/${options.releaseId}`
  const releaseUrl = `/${releasePath}/database.bin`
  const configPath = `${adminPath}/config/${options.configId}`
  const configUrl = `/${configPath}/config.js`
  const snapshot = await buildEntryDatabase(config, source)
  const release = await exportEntryRelease({
    bundleId: options.releaseId,
    bundleUrl: releaseUrl,
    snapshot
  })
  return {
    release,
    releasePath,
    releaseUrl,
    configPath,
    configUrl,
    catalogJson: JSON.stringify(
      serializeReplicaCatalog(release.catalog),
      null,
      2
    ),
    handlerKeysJson: JSON.stringify(serializeHandlerKeys(release.keys), null, 2)
  }
}
