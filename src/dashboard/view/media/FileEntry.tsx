import {Media} from 'alinea/backend/Media'
import {EntryRow} from 'alinea/core'
import {fromModule} from 'alinea/ui'
import {Main} from 'alinea/ui/Main'
import {Property} from 'alinea/ui/Property'
import {useAtomValue} from 'jotai'
import prettyBytes from 'pretty-bytes'
import {useNav} from '../../hook/UseNav.js'
import {EntryEditProps} from '../EntryEdit.js'
import {EntryHeader} from '../entry/EntryHeader.js'
import {EntryTitle} from '../entry/EntryTitle.js'
import css from './FileEntry.module.scss'

const styles = fromModule(css)

function ImageView({editor}: EntryEditProps) {
  const image: Media.Image = useAtomValue(editor.draftEntry) as EntryRow<any>
  return (
    <div>
      <img src={image.data.preview} />

      <Property label="Extension">{image.data.extension}</Property>
      <Property label="File size">{prettyBytes(image.data.size)}</Property>
      <Property label="Dimensions">
        {image.data.width} x {image.data.height} pixels
      </Property>
    </div>
  )
}

function FileView({editor}: EntryEditProps) {
  const file: Media.File = useAtomValue(editor.draftEntry) as EntryRow<any>
  return (
    <div>
      <Property label="Extension">{file.data.extension}</Property>
      <Property label="File size">{prettyBytes(file.data.size)}</Property>
    </div>
  )
}

export function FileEntry(props: EntryEditProps) {
  const nav = useNav()
  const {editor} = props
  const isImage = Media.isImage(editor.version.path)
  return (
    <Main className={styles.root()}>
      <EntryHeader editor={editor} />
      <Main.Container>
        <EntryTitle
          editor={editor}
          backLink={
            editor.version.parent
              ? nav.entry({
                  entryId: editor.version.parent,
                  workspace: editor.version.workspace
                })
              : undefined
          }
        />
        {isImage ? <ImageView {...props} /> : <FileView {...props} />}
      </Main.Container>
    </Main>
  )
}
