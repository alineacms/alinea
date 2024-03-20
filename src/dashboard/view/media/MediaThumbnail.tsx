import {link} from 'alinea/dashboard/util/HashRouter'
import {fromModule, px} from 'alinea/ui'
import {useContrastColor} from 'alinea/ui/hook/UseContrastColor'
import {IcRoundInsertDriveFile} from 'alinea/ui/icons/IcRoundInsertDriveFile'
import {useNav} from '../../hook/UseNav.js'
import css from './MediaThumbnail.module.scss'

const styles = fromModule(css)

export type MediaThumbnailProps = {
  file: {
    entryId: string
    title: string
    extension: string
    size: number
    preview: string
    averageColor: string
  }
}

export function MediaThumbnail({file}: MediaThumbnailProps) {
  const nav = useNav()
  const {extension, preview, averageColor: color} = file
  const fontColor = useContrastColor(color)
  return (
    <a {...link(nav.entry(file))} className={styles.root()}>
      <div className={styles.root.preview()}>
        <div className={styles.root.preview.picture()}>
          {preview ? (
            <img
              src={preview}
              className={styles.root.preview.picture.image()}
            />
          ) : (
            <div className={styles.root.preview.icon()}>
              <IcRoundInsertDriveFile style={{fontSize: px(36)}} />
            </div>
          )}
        </div>
        <div className={styles.root.title()}>
          <span className={styles.root.title.text()}>{file.title}</span>
          <div className={styles.root.title.extension()}>{extension}</div>
        </div>
      </div>
    </a>
  )
}
