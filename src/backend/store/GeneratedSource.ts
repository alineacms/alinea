import {MemorySource} from '#/core/source/MemorySource.js'
import {importSource} from '#/core/source/SourceExport.js'
import PLazy from 'p-lazy'

export const generatedSource: Promise<MemorySource> = PLazy.from(async () => {
  try {
    // @ts-ignore
    const {source} = await import('@alinea/generated/source.js')
    const imported = await importSource(<any>source)
    return imported
  } catch (error) {
    console.error(error)
    return new MemorySource()
  }
})
