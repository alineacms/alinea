import {AuthedContext, Media, Target} from 'alinea/backend/Backend'
import {FS} from 'alinea/backend/FS'
import {Source, SourceEntry, WatchFiles} from 'alinea/backend/Source'
import {ChangeType} from 'alinea/backend/data/ChangeSet'
import {JsonLoader} from 'alinea/backend/loader/JsonLoader'
import {applyJsonPatch} from 'alinea/backend/util/JsonPatch'
import {Config} from 'alinea/core/Config'
import {Connection} from 'alinea/core/Connection'
import {createId} from 'alinea/core/Id'
import {outcome} from 'alinea/core/Outcome'
import {Root} from 'alinea/core/Root'
import {Workspace} from 'alinea/core/Workspace'
import {entries, keys, values} from 'alinea/core/util/Objects'
import * as path from 'alinea/core/util/Paths'
import {basename, dirname, extname, join} from 'alinea/core/util/Paths'
import {slugify} from 'alinea/core/util/Slugs'

export interface LocalDataOptions {
  config: Config
  fs: FS
  rootDir?: string
  dashboardUrl?: string
}

async function filesOfPath(fs: FS, dir: string): Promise<WatchFiles> {
  const res: WatchFiles = {files: [], dirs: []}
  try {
    const files = await fs.readdir(dir)
    for (const file of files) {
      const location = path.join(dir, file)
      const stat = await fs.stat(location)
      if (stat.isDirectory()) {
        const contents = await filesOfPath(fs, location)
        res.dirs.push(location, ...contents.dirs)
        res.files.push(...contents.files)
      } else {
        res.files.push(location)
      }
    }
    return res
  } catch (e) {
    return res
  }
}

export class LocalData implements Source, Target, Media {
  constructor(public options: LocalDataOptions) {}

  async watchFiles() {
    const {fs, config, rootDir = '.'} = this.options
    const res: WatchFiles = {files: [], dirs: []}
    for (const workspace of values(config.workspaces)) {
      const contentDir = Workspace.data(workspace).source
      res.dirs.push(path.join(rootDir, contentDir))
      for (const rootName of keys(workspace)) {
        const rootPath = path.join(rootDir, contentDir, rootName)
        res.dirs.push(rootPath)
        const contents = await filesOfPath(fs, rootPath)
        res.files.push(...contents.files)
        res.dirs.push(...contents.dirs)
      }
    }
    return res
  }

  async *entries(): AsyncGenerator<SourceEntry> {
    const {config, fs, rootDir = '.'} = this.options
    const BATCH_SIZE = 4
    const batch: Array<() => Promise<SourceEntry>> = []
    async function* runBatch() {
      for (const entry of await Promise.all(
        batch.splice(0, batch.length).map(fn => fn())
      ))
        yield entry
    }
    for (const [workspaceName, workspace] of entries(config.workspaces)) {
      const contentDir = Workspace.data(workspace).source
      for (const [rootName, root] of entries(workspace)) {
        const {i18n} = Root.data(root)
        const locales = i18n?.locales || [undefined]
        for (const locale of locales) {
          const targets = [locale ? `/${locale.toLowerCase()}` : '/']
          while (targets.length > 0) {
            const target = targets.shift()!
            const [files, err] = await outcome(
              fs.readdir(path.join(rootDir, contentDir, rootName, target))
            )
            if (!files) continue
            const toRead = []
            for (const file of files) {
              const location = path.join(
                rootDir,
                contentDir,
                rootName,
                target,
                file
              )
              const stat = await fs.stat(location)
              if (stat.isDirectory()) {
                targets.push(path.join(target, file))
              } else {
                if (batch.length >= BATCH_SIZE) yield* runBatch()
                const filePath = path.join(target, file)
                toRead.push({filePath, location})
                batch.push(async (): Promise<SourceEntry> => {
                  const contents = await fs.readFile(location)
                  return {
                    locale,
                    workspace: workspaceName,
                    root: rootName,
                    filePath,
                    contents,
                    modifiedAt: stat.mtime.getTime()
                  }
                })
              }
            }
          }
        }
      }
    }
    yield* runBatch()
  }

  async mutate(
    ctx: AuthedContext,
    {mutations}: Connection.MutateParams
  ): Promise<{commitHash: string}> {
    const {fs, rootDir = '.', config} = this.options
    const noop = () => {}
    for (const {changes} of mutations) {
      for (const change of changes) {
        if (!change.type) continue
        switch (change.type) {
          case ChangeType.Write: {
            const location = path.join(rootDir, change.file)
            await fs
              .mkdir(path.dirname(location), {recursive: true})
              .catch(noop)
              .then(() => fs.writeFile(location, change.contents))
            continue
          }
          case ChangeType.Rename: {
            const location = path.join(rootDir, change.from)
            const newLocation = path.join(rootDir, change.to)
            await fs.rename(location, newLocation).catch(noop)
            continue
          }
          case ChangeType.Delete: {
            const location = path.join(rootDir, change.file)
            await fs.rm(location, {recursive: true, force: true}).catch(noop)
            continue
          }
          case ChangeType.Patch: {
            const location = path.join(rootDir, change.file)
            const contents = await fs.readFile(location)
            const record = JsonLoader.parse(config.schema, contents)
            const newContents = applyJsonPatch(record, change.patch)
            await fs.writeFile(
              location,
              JsonLoader.format(config.schema, newContents)
            )
          }
        }
      }
    }
    return {commitHash: createId()}
  }

  isInMediaLocation(file: string): boolean {
    const {config, rootDir = '.'} = this.options
    const mediaDirs: Array<string> = values(config.workspaces)
      .map(workspace => Workspace.data(workspace).mediaDir!)
      .filter(Boolean)
    return mediaDirs.some(dir => path.contains(path.join(rootDir, dir), file))
  }

  async prepareUpload(
    ctx: AuthedContext,
    file: string
  ): Promise<Connection.UploadResponse> {
    const {dashboardUrl} = this.options
    if (!dashboardUrl)
      throw new Error(`Cannot prepare upload without dashboard url`)
    const entryId = createId()
    const dir = dirname(file)
    const extension = extname(file).toLowerCase()
    const name = basename(file, extension)
    const fileName = `${slugify(name)}.${entryId}${extension}`
    const fileLocation = join(dir, fileName)
    return {
      entryId,
      location: fileLocation,
      previewUrl: new URL(
        `?/preview&file=${encodeURIComponent(fileLocation)}`,
        dashboardUrl
      ).href,
      url: new URL(
        `?/upload&file=${encodeURIComponent(fileLocation)}`,
        dashboardUrl
      ).href
    }
  }
}
