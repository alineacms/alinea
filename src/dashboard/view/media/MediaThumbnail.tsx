import {Media, renderLabel} from 'alinea/core'
import {fromModule, px} from 'alinea/ui'
import {useContrastColor} from 'alinea/ui/hook/UseContrastColor'
import {IcRoundInsertDriveFile} from 'alinea/ui/icons/IcRoundInsertDriveFile'
import {link} from 'alinea/ui/util/HashRouter'
import {useNav} from '../../hook/UseNav'
import css from './MediaThumbnail.module.scss'

const styles = fromModule(css)

export type MediaThumbnailProps = {
  file: Media.File.Preview
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
          <span className={styles.root.title.text()}>
            {renderLabel(file.title)}
          </span>
          <div className={styles.root.title.extension()}>{extension}</div>
        </div>
      </div>
    </a>
  )
}
