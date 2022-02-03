import {Media} from '@alinea/core'
import {fromModule} from '@alinea/ui'
import css from './MediaThumbnail.module.scss'

const styles = fromModule(css)

export type MediaThumbnailProps = {
  file: Media.File.Preview
}

export function MediaThumbnail({file}: MediaThumbnailProps) {
  return (
    <div className={styles.root()}>
      {file.preview && <img src={file.preview} />}
      {file.title}
      <div>Size: {file.size}</div>
      <div>Extension: {file.extension}</div>
    </div>
  )
}
