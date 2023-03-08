import {FS} from 'alinea/backend/FS'
import {Config} from 'alinea/core/Config'
import {Hub} from 'alinea/core/Hub'
import {outcome} from 'alinea/core/Outcome'
import * as path from 'alinea/core/util/Paths'
import {Source, SourceEntry} from '../Source.js'
import {Target} from '../Target.js'

export type FileDataOptions = {
  config: Config
  fs: FS
  rootDir?: string
}

export class FileData implements Source, Target {
  canRename = true

  constructor(public options: FileDataOptions) {}

  async *entries(): AsyncGenerator<SourceEntry> {
    const {config, fs, rootDir = '.'} = this.options
    for (const [workspace, {source: contentDir, roots}] of Object.entries(
      config.workspaces
    )) {
      for (const {name: root, i18n} of Object.values(roots)) {
        const locales = i18n?.locales || [undefined]
        for (const locale of locales) {
          const targets = [locale ? `/${locale}` : '/']
          while (targets.length > 0) {
            const target = targets.shift()!
            const [files, err] = await outcome(
              fs.readdir(path.join(rootDir, contentDir, root, target))
            )
            if (!files) continue
            const toRead = []
            for (const file of files) {
              const location = path.join(
                rootDir,
                contentDir,
                root,
                target,
                file
              )
              const stat = await fs.stat(location)
              if (stat.isDirectory()) {
                targets.push(path.join(target, file))
              } else {
                const filePath = path.join(target, file)
                toRead.push({filePath, location})
                const contents = await fs.readFile(location)
                yield {
                  workspace,
                  root,
                  filePath,
                  contents,
                  modifiedAt: stat.mtime.getTime()
                }
              }
            }
          }
        }
      }
    }
  }

  async publish({changes}: Hub.ChangesParams) {
    const {fs, rootDir = '.'} = this.options
    const tasks = []
    const noop = () => {}
    for (const {file, contents} of changes.write) {
      const location = path.join(rootDir, file)
      tasks.push(
        fs
          .mkdir(path.dirname(location), {recursive: true})
          .catch(noop)
          .then(() => fs.writeFile(location, contents))
      )
    }
    for (const {file: a, to: b} of changes.rename) {
      const location = path.join(rootDir, a)
      const newLocation = path.join(rootDir, b)
      tasks.push(fs.rename(location, newLocation).catch(noop))
    }
    for (const {file} of changes.delete) {
      const location = path.join(rootDir, file)
      tasks.push(fs.rm(location, {recursive: true, force: true}).catch(noop))
    }
    return Promise.all(tasks).then(() => void 0)
  }
}
