// Source: https://github.com/rhysd/dirname-filename-esm/blob/cd72f459508a03856bc00a7a9878ef2fefa609ba/index.js

import {dirname as pathDirname} from 'node:path'
import {fileURLToPath} from 'node:url'

export function dirname(importMeta: {url?: string}) {
  return pathDirname(filename(importMeta))
}

export function filename(importMeta: {url?: string}) {
  return importMeta.url ? fileURLToPath(importMeta.url) : ''
}
