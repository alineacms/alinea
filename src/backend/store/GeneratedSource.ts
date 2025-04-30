import {MemorySource} from 'alinea/core/source/MemorySource'
import {importSource} from 'alinea/core/source/SourceExport'
import PLazy from 'p-lazy'

export const generatedSource: Promise<MemorySource> = PLazy.from(async () => {
  try {
    // @ts-ignore
    const {default: source} = await import('@alinea/generated/source.json', {
      with: {type: 'json'}
    })
    const imported = await importSource(<any>source)
    return imported
  } catch (error) {
    console.error(error)
    return new MemorySource()
  }
})
