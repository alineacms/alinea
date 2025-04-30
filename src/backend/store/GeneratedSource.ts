import {MemorySource} from 'alinea/core/source/MemorySource'
import {importSource} from 'alinea/core/source/SourceExport'
import PLazy from 'p-lazy'

export const generatedSource: Promise<MemorySource> = PLazy.from(async () => {
  try {
    // @ts-ignore
    const source: any = await import('@alinea/generated/source.json', {
      with: {type: 'json'}
    })
    return await importSource(source)
  } catch {
    return new MemorySource()
  }
})
