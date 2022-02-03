import {Media, Outcome} from '@alinea/core'
import {fromModule, HStack} from '@alinea/ui'
import {useQuery} from 'react-query'
import {useSession} from '../../hook/UseSession'
import css from './MediaRow.module.scss'
import {MediaThumbnail} from './MediaThumbnail'

const {File} = Media

const styles = fromModule(css)

export type MediaRowProps = {
  parentId: string
  from: number
  to: number
}

export function MediaRow({parentId, from, to}: MediaRowProps) {
  const {hub} = useSession()
  const batchSize = 4
  const start = Math.floor(from / batchSize)
  const {data} = useQuery(['batch', parentId, start], () => {
    return hub
      .query(
        File.where(File.$parent.is(parentId))
          .skip(start * batchSize)
          .take(batchSize)
          .select({
            id: File.id,
            title: File.title,
            extension: File.extension,
            size: File.size,
            preview: File.preview
          })
      )
      .then(Outcome.unpack)
  })
  const files = data?.slice(from % batchSize, to % batchSize)
  return (
    <div className={styles.root()}>
      <HStack gap={15} style={{height: '100%'}}>
        {files?.map(file => (
          <MediaThumbnail key={file.id} file={file} />
        ))}
      </HStack>
    </div>
  )
}
