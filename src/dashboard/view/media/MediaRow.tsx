import {Entry} from 'alinea/core'
import {MediaFile} from 'alinea/core/media/MediaSchema'
import {fromModule} from 'alinea/ui'
import {useAtomValue} from 'jotai'
import {useQuery} from 'react-query'
import {graphAtom} from '../../atoms/EntryAtoms.js'
import css from './MediaRow.module.scss'
import {MediaThumbnail} from './MediaThumbnail.js'

const styles = fromModule(css)

export type MediaRowProps = {
  amount: number
  parentId: string
  from: number
  batchSize: number
}

export function MediaRow({amount, parentId, from, batchSize}: MediaRowProps) {
  const graph = useAtomValue(graphAtom)
  const start = Math.floor(from / batchSize)
  const {data} = useQuery(
    ['media', 'batch', batchSize, parentId, start],
    () => {
      return graph.active.find(
        MediaFile()
          .where(Entry.parent.is(parentId))
          .skip(start * batchSize)
          .take(batchSize)
          .select({
            entryId: Entry.entryId,
            title: Entry.title,
            extension: MediaFile.extension,
            size: MediaFile.size,
            preview: MediaFile.preview,
            averageColor: MediaFile.averageColor
          })
          .orderBy(Entry.title.asc())
      )
    },
    {
      staleTime: 10000,
      refetchOnWindowFocus: false
    }
  )
  const startAt = from % batchSize
  const files = data?.slice(startAt, startAt + amount)
  return (
    <div className={styles.root()}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${amount}, 1fr)`,
          height: '100%'
        }}
      >
        {files?.map(file => (
          <MediaThumbnail key={file.entryId} file={file} />
        ))}
      </div>
    </div>
  )
}
