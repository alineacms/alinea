import {MemorySource} from 'alinea/core/source/MemorySource'
import {importSource} from 'alinea/core/source/SourceExport'
import type {Config} from 'alinea/core/Config'
import {ContentEntryDB} from 'alinea/core/engine/ContentEntryDB'
import PLazy from 'p-lazy'

export const generatedSource: Promise<MemorySource> = PLazy.from(async () => {
  try {
    // @ts-ignore
    const {source} = await import('@alinea/generated/source.js')
    if (!source) return new MemorySource()
    const imported = await importSource(<any>source)
    return imported
  } catch (error) {
    console.error(error)
    return new MemorySource()
  }
})

export async function generatedContentDB(config: Config): Promise<ContentEntryDB> {
  try {
    // @ts-ignore
    const {content} = await import('@alinea/generated/source.js')
    if (typeof content === 'string')
      return ContentEntryDB.openCompressed(config, content)
  } catch (error) {
    console.error(error)
  }
  return new ContentEntryDB(config)
}
