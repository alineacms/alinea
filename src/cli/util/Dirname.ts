// Source: https://github.com/rhysd/dirname-filename-esm/blob/cd72f459508a03856bc00a7a9878ef2fefa609ba/index.js

import {dirname as pathDirname} from 'node:path'
import {fileURLToPath} from 'node:url'

export function dirname(url?: string) {
  return pathDirname(filename(url))
}

export function filename(url?: string) {
  return url ? fileURLToPath(url) : ''
}
