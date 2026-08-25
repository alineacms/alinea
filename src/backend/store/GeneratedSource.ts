import type {MemorySource} from '#/core/source/MemorySource.js'
import {importSource, type ExportedSource} from '#/core/source/SourceExport.js'
import PLazy from 'p-lazy'
import {readGeneratedJson} from './GeneratedArtifacts.js'

export const generatedSource: Promise<MemorySource> = PLazy.from(async () => {
  const source = await readGeneratedJson<ExportedSource>('source.json')
  return importSource(source)
})
