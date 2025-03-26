import {MemorySource} from 'alinea/core/source/MemorySource.js'
import {importSource} from 'alinea/core/source/SourceExport.js'
import PLazy from 'p-lazy'

export const generatedSource: Promise<MemorySource> = PLazy.from(async () => {
  // @ts-ignore
  return import('@alinea/generated/source.json', {with: {type: 'json'}})
    .then(imported => importSource(imported))
    .catch(() => new MemorySource())
})
