import {Media, Outcome} from 'alinea/core'
import {fromModule} from 'alinea/ui'
import {useQuery} from 'react-query'
import {useSession} from '../../hook/UseSession'
import css from './MediaRow.module.scss'
import {MediaThumbnail} from './MediaThumbnail'

const {File} = Media

const styles = fromModule(css)

export type MediaRowProps = {
  amount: number
  parentId: string
  from: number
  batchSize: number
}

function query(parentId: string, start: number, batchSize: number) {
  return File.where(File.alinea.parent.is(parentId))
    .skip(start * batchSize)
    .take(batchSize)
    .select({
      id: File.id,
      alinea: File.alinea,
      title: File.title,
      extension: File.extension,
      size: File.size,
      preview: File.preview,
      averageColor: File.averageColor
    })
    .orderBy(File.title.asc())
}

export function MediaRow({amount, parentId, from, batchSize}: MediaRowProps) {
  const {hub} = useSession()
  const start = Math.floor(from / batchSize)
  const {data} = useQuery(
    ['media', 'batch', batchSize, parentId, start],
    () => {
      return hub
        .query({cursor: query(parentId, start, batchSize)})
        .then(Outcome.unpack)
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
          <MediaThumbnail key={file.id} file={file} />
        ))}
      </div>
    </div>
  )
}
