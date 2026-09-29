import fs from 'node:fs/promises'
import path from 'node:path'
import {Config} from '#/core/Config.js'
import {Entry} from '#/core/Entry.js'
import {MediaLocation} from '#/core/media/MediaLocation.js'
import {MediaFile} from '#/core/media/MediaTypes.js'
import {contains, join} from '#/core/util/Paths.js'
import type {DevDB} from './DevDB.js'

/**
 * Link every published media file on disk under its public file URL, so the
 * host serves it as a static file. Files synced after the build have no link
 * and fall through to the handler.
 */
export async function linkMediaFiles(
  rootDir: string,
  db: DevDB
): Promise<number> {
  const {config} = db
  const publicDir = join(rootDir, config.publicDir)
  const fileRoot = Config.filePathname(config, '')
  const linkDir = join(publicDir, fileRoot)
  await fs.rm(linkDir, {recursive: true, force: true})
  const files = await db.find({
    type: MediaFile,
    status: 'published',
    main: true,
    select: {
      url: Entry.url,
      workspace: Entry.workspace,
      location: MediaFile.location
    }
  })
  const linked = new Set<string>()
  for (const file of files) {
    if (typeof file.location !== 'string') continue
    const source = MediaLocation.sourceUrl(
      config,
      file.workspace,
      file.location
    )
    if (!source || source === file.url) continue
    const link = join(publicDir, file.url)
    if (!contains(linkDir, link) || linked.has(link)) continue
    const target = join(publicDir, source)
    const exists = await fs.stat(target).then(
      stats => stats.isFile(),
      () => false
    )
    if (!exists) continue
    await fs.mkdir(path.dirname(link), {recursive: true})
    // Relative, so the link survives the public dir being copied elsewhere.
    // Windows only allows symlinks with developer mode or admin rights.
    await fs
      .symlink(path.relative(path.dirname(link), target), link)
      .catch(() => fs.copyFile(target, link))
    linked.add(link)
  }
  return linked.size
}
