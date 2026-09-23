import {existsSync, lstatSync, realpathSync, rmSync, symlinkSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import path from 'node:path'

const dir = path.dirname(fileURLToPath(import.meta.url))
const link = path.resolve(dir, '..', 'node_modules', 'alinea')
const root = path.resolve(dir, '..', '..', '..')

function main() {
  try {
    if (existsSync(link)) {
      if (lstatSync(link).isSymbolicLink()) {
        if (realpathSync(link) === root) return
        rmSync(link)
      } else {
        rmSync(link, {recursive: true, force: true})
      }
    }
    symlinkSync('../../../', link, 'dir')
  } catch (error) {
    console.warn('fix-alinea-link:', error.message)
  }
}

main()