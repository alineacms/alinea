import {Media} from 'alinea/backend/Media'
import {EntryRow} from 'alinea/core'
import {Typo, fromModule} from 'alinea/ui'
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
      <Property label="URL">
        <Typo.Monospace>
          {Media.ORIGINAL_LOCATION in image.data
            ? (image.data[Media.ORIGINAL_LOCATION] as string)
            : image.data.location}
        </Typo.Monospace>
      </Property>
      {image.data.focus && (
        <Property label="Focus">
          ({image.data.focus.x.toFixed(2)}, {image.data.focus.y.toFixed(2)})
        </Property>
      )}
    </div>
  )
}

function FileView({editor}: EntryEditProps) {
  const file: Media.File = useAtomValue(editor.draftEntry) as EntryRow<any>
  return (
    <div>
      <Property label="Extension">{file.data.extension}</Property>
      <Property label="File size">{prettyBytes(file.data.size)}</Property>

      <Property label="URL">
        <Typo.Monospace>
          {Media.ORIGINAL_LOCATION in file.data
            ? (file.data[Media.ORIGINAL_LOCATION] as string)
            : file.data.location}
        </Typo.Monospace>
      </Property>
    </div>
  )
}

export function FileEntry(props: EntryEditProps) {
  const nav = useNav()
  const {editor} = props
  const isImage = Media.isImage(editor.activeVersion.data.extension)
  return (
    <Main className={styles.root()}>
      <EntryHeader editable={false} editor={editor} />
      <EntryTitle
        editor={editor}
        backLink={
          editor.activeVersion.parent
            ? nav.entry({
                entryId: editor.activeVersion.parent,
                workspace: editor.activeVersion.workspace
              })
            : nav.entry({entryId: undefined})
        }
      />
      <Main.Container>
        {isImage ? <ImageView {...props} /> : <FileView {...props} />}
      </Main.Container>
    </Main>
  )
}
