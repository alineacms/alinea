import {Media} from '@alinea/core'
import {fromModule} from '@alinea/ui'
import {useContrastColor} from '@alinea/ui/hook/UseContrastColor'
import {MdInsertDriveFile} from 'react-icons/md'
import {Link} from 'react-router-dom'
import {useDashboard} from '../../hook/UseDashboard'
import css from './MediaThumbnail.module.scss'

const styles = fromModule(css)

export type MediaThumbnailProps = {
  file: Media.File.Preview
}

export function MediaThumbnail({file}: MediaThumbnailProps) {
  const {nav} = useDashboard()
  const {extension, preview, averageColor: color} = file
  const fontColor = useContrastColor(color)
  return (
    <Link
      to={nav.entry(file.workspace, file.root, file.id)}
      className={styles.root()}
    >
      <div className={styles.root.preview()}>
        <div className={styles.root.preview.picture()}>
          {preview ? (
            <img
              src={preview}
              className={styles.root.preview.picture.image()}
            />
          ) : (
            <div className={styles.root.preview.icon()}>
              <MdInsertDriveFile size={36} />
            </div>
          )}
        </div>
        <div className={styles.root.title()}>
          <span className={styles.root.title.text()}>{file.title}</span>
          <div className={styles.root.title.extension()}>{extension}</div>
        </div>
      </div>
    </Link>
  )
}
