import styler from '@alinea/styler'
import {Config} from 'alinea/core/Config'
import type {Entry} from 'alinea/core/Entry'
import {isImage} from 'alinea/core/media/IsImage'
import {MEDIA_LOCATION} from 'alinea/core/media/MediaLocation'
import type {MediaFile} from 'alinea/core/media/MediaTypes'
import {outcome} from 'alinea/core/Outcome'
import {Typo} from 'alinea/ui'
import {Lift} from 'alinea/ui/Lift'
import {Main} from 'alinea/ui/Main'
import {Property} from 'alinea/ui/Property'
import {transparentize} from 'color2k'
import {useAtomValue} from 'jotai'
import prettyBytes from 'pretty-bytes'
import {useState} from 'react'
import {FormProvider} from '../../atoms/FormAtoms.js'
import {InputField} from '../../editor/InputForm.js'
import {useField} from '../../editor/UseField.js'
import {useConfig} from '../../hook/UseConfig.js'
import {useNav} from '../../hook/UseNav.js'
import type {EntryEditProps} from '../EntryEdit.js'
import {EntryHeader} from '../entry/EntryHeader.js'
import {EntryTitle} from '../entry/EntryTitle.js'
import css from './FileEntry.module.scss'

const styles = styler(css)

interface Pos {
  x?: number
  y?: number
}

function ImageView({type, editor}: EntryEditProps & {type: typeof MediaFile}) {
  const config = useConfig()
  const image: Entry<MediaFile> = editor.activeVersion as any
  const {value: focus = {x: 0.5, y: 0.5}, mutator: setFocus} = useField(
    type.focus
  )
  const [hover, setHover] = useState<Pos>({})
  const {x: focusX = focus.x, y: focusY = focus.y} = hover
  const location = image.data.location
  const [liveUrl] = outcome(
    () => new URL(location, Config.baseUrl(config) ?? window.location.href)
  )
  return (
    <Lift className={styles.image()}>
      <div
        className={styles.image.wrapper()}
        style={{
          backgroundImage:
            image.data.averageColor &&
            `linear-gradient(45deg, ${transparentize(
              image.data.averageColor,
              0.6
            )} 0%, ${transparentize(image.data.averageColor, 0.8)} 100%)`
        }}
      >
        <div
          className={styles.image.preview()}
          onMouseMove={event => {
            const rect = event.currentTarget.getBoundingClientRect()
            const x = (event.clientX - rect.left) / rect.width
            const y = (event.clientY - rect.top) / rect.height
            setHover({x, y})
          }}
          onMouseOut={() => setHover({})}
          onBlur={() => setHover({})}
          onClick={event => {
            event.preventDefault()
            const rect = event.currentTarget.getBoundingClientRect()
            const x = (event.clientX - rect.left) / rect.width
            const y = (event.clientY - rect.top) / rect.height
            setFocus({x, y})
          }}
        >
          <img
            className={styles.image.preview.img()}
            src={image.data.preview}
            alt="Preview of media file"
          />
          <span
            className={styles.image.preview.focus()}
            style={{
              left: `${focus.x * 100}%`,
              top: `${focus.y * 100}%`
            }}
          />
        </div>
      </div>
      <div className={styles.image.content()}>
        <InputField field={type.title} />
        <Property label="Extension">{image.data.extension}</Property>
        <Property label="File size">{prettyBytes(image.data.size)}</Property>
        <Property label="Dimensions">
          {image.data.width} x {image.data.height} pixels
        </Property>
        <Property label="URL">
          <a
            href={liveUrl ? String(liveUrl) : location}
            target="_blank"
            title={location}
            className={styles.image.content.url()}
          >
            <Typo.Monospace>{location}</Typo.Monospace>
          </a>
        </Property>
        <Property
          label="Focus point"
          help="Click on the image to change the focus point"
        >
          ({focusX.toFixed(2)}, {focusY.toFixed(2)})
        </Property>
      </div>
    </Lift>
  )
}

export function IcTwotonePinDrop() {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 24 16"
      style={{display: 'block'}}
    >
      <path
        fill="var(--alinea-background)"
        d="M12 3C9.19 3 6 5.11 6 9.13c0 2.68 2 5.49 6 8.44c4-2.95 6-5.77 6-8.44C18 5.11 14.81 3 12 3z"
      />
      <path
        fill="var(--alinea-foreground)"
        d="M12 4c1.93 0 5 1.4 5 5.15c0 2.16-1.72 4.67-5 7.32c-3.28-2.65-5-5.17-5-7.32C7 5.4 10.07 4 12 4m0-2C8.73 2 5 4.46 5 9.15c0 3.12 2.33 6.41 7 9.85c4.67-3.44 7-6.73 7-9.85C19 4.46 15.27 2 12 2z"
      />
      <path
        fill="var(--alinea-foreground)"
        d="M12 7c-1.1 0-2 .9-2 2s.9 2 2 2s2-.9 2-2s-.9-2-2-2z"
      />
    </svg>
  )
}

function FileView({type, editor}: EntryEditProps & {type: typeof MediaFile}) {
  const file: Entry<MediaFile> = editor.activeVersion as any
  return (
    <Lift>
      <InputField field={type.title} />
      <Property label="Extension">{file.data.extension}</Property>
      <Property label="File size">{prettyBytes(file.data.size)}</Property>

      <Property label="URL">
        <Typo.Monospace>
          {MEDIA_LOCATION in file.data
            ? (file.data[MEDIA_LOCATION] as string)
            : file.data.location}
        </Typo.Monospace>
      </Property>
    </Lift>
  )
}

export function FileEntry(props: EntryEditProps & {type: typeof MediaFile}) {
  const nav = useNav()
  const {editor} = props
  const form = useAtomValue(editor.form)
  return (
    <Main className={styles.root()}>
      <EntryHeader editor={editor} />
      <EntryTitle
        editor={editor}
        backLink={
          editor.activeVersion.parentId
            ? nav.entry({
                id: editor.activeVersion.parentId,
                workspace: editor.activeVersion.workspace
              })
            : nav.entry({id: undefined})
        }
      />
      <FormProvider form={form}>
        <Main.Container>
          {isImage(editor.activeVersion.data.extension as string) ? (
            <ImageView {...props} />
          ) : (
            <FileView {...props} />
          )}
        </Main.Container>
      </FormProvider>
    </Main>
  )
}
