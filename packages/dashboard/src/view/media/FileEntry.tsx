import {Media} from '@alinea/core/Media'
import {fromModule, Property, useObservable} from '@alinea/ui'
import {Main} from '@alinea/ui/Main'
import prettyBytes from 'pretty-bytes'
import {useNav} from '../../hook/UseNav'
import {EditMode} from '../entry/EditMode'
import {EntryHeader} from '../entry/EntryHeader'
import {EntryTitle} from '../entry/EntryTitle'
import {EntryEditProps} from '../EntryEdit'
import css from './FileEntry.module.scss'

const styles = fromModule(css)

function ImageView({draft}: EntryEditProps) {
  const image = useObservable(draft.entry) as Media.Image
  return (
    <div>
      <img src={image.preview} />

      <Property label="Extension">{image.extension}</Property>
      <Property label="File size">{prettyBytes(image.size)}</Property>
      <Property label="Dimensions">
        {image.width} x {image.height} pixels
      </Property>
    </div>
  )
}

function FileView({draft}: EntryEditProps) {
  const file = useObservable(draft.entry) as Media.File
  return (
    <div>
      <Property label="Extension">{file.extension}</Property>
      <Property label="File size">{prettyBytes(file.size)}</Property>
    </div>
  )
}

export function FileEntry(props: EntryEditProps) {
  const nav = useNav()
  const {draft} = props
  const isImage = Media.isImage(draft.url)
  return (
    <Main className={styles.root()}>
      <EntryHeader mode={EditMode.Editing} />
      <Main.Container>
        <EntryTitle
          backLink={
            draft.parent &&
            nav.entry({
              id: draft.parent,
              workspace: draft.workspace
            })
          }
        />
        {isImage ? <ImageView {...props} /> : <FileView {...props} />}
      </Main.Container>
    </Main>
  )
}
