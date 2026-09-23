import styler from '@alinea/styler'
import {
  createContext,
  type ReactNode,
  useContext,
  useRef,
  useState
} from 'react'
import {
  DropZone as DropZonePrimitive,
  isFileDropItem
} from 'react-aria-components'
import {Button, type ButtonProps} from './Button.js'
import css from './DropZone.module.css'
import type {AriaProps, DataProps, StyleProps} from './types.js'

const styles = styler(css)

interface DropZoneContextValue {
  accept?: Array<string>
  multiple: boolean
  disabled?: boolean
  onDropFiles: (files: Array<File>) => void
}

const DropZoneContext = createContext<DropZoneContextValue | undefined>(
  undefined
)

export interface DropZoneProps extends StyleProps, AriaProps, DataProps {
  /** Called with the dropped or picked files that match `accept` */
  onDropFiles: (files: Array<File>) => void
  /**
   * Accepted mime types (`image/png`, `image/*`) or file extensions (`.pdf`),
   * every file is accepted if left out
   */
  accept?: Array<string>
  /** Accept more than one file at a time, defaults to true */
  multiple?: boolean
  disabled?: boolean
  children?: ReactNode
}

/** An area files can be dropped on, add a DropZoneTrigger to browse files */
export function DropZone({
  onDropFiles,
  accept,
  multiple = true,
  disabled,
  className,
  children,
  ...props
}: DropZoneProps) {
  const [dragOver, setDragOver] = useState(false)
  function receive(files: Array<File>) {
    const accepted = files.filter(file => acceptsFile(accept, file))
    const result = multiple ? accepted : accepted.slice(0, 1)
    if (result.length > 0) onDropFiles(result)
  }
  return (
    <DropZoneContext.Provider
      value={{accept, multiple, disabled, onDropFiles: receive}}
    >
      <DropZonePrimitive
        data-slot="drop-zone"
        {...props}
        data-drag-over={dragOver || undefined}
        data-disabled={disabled || undefined}
        isDisabled={disabled}
        className={styles.DropZone(styler.merge({className}))}
        getDropOperation={types =>
          acceptsTypes(accept, types) ? 'copy' : 'cancel'
        }
        onDropEnter={() => setDragOver(true)}
        onDropExit={() => setDragOver(false)}
        onDrop={async event => {
          setDragOver(false)
          const files = await Promise.all(
            event.items.filter(isFileDropItem).map(item => item.getFile())
          )
          receive(files)
        }}
      >
        {children}
      </DropZonePrimitive>
    </DropZoneContext.Provider>
  )
}

export interface DropZoneTriggerProps extends Omit<ButtonProps, 'asChild'> {}

/** A button that opens the file browser of the surrounding DropZone */
export function DropZoneTrigger({
  onClick,
  disabled,
  ...props
}: DropZoneTriggerProps) {
  const context = useContext(DropZoneContext)
  if (!context) throw new Error('DropZoneTrigger must be used in a DropZone')
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <Button
        data-slot="drop-zone-trigger"
        {...props}
        disabled={disabled || context.disabled}
        onClick={event => {
          onClick?.(event)
          if (!event.defaultPrevented) input.current?.click()
        }}
      />
      <input
        ref={input}
        type="file"
        hidden
        tabIndex={-1}
        accept={context.accept?.join(',')}
        multiple={context.multiple}
        onChange={event => {
          const files = Array.from(event.currentTarget.files ?? [])
          event.currentTarget.value = ''
          context.onDropFiles(files)
        }}
      />
    </>
  )
}

export interface DropZoneDescriptionProps extends StyleProps {
  children?: ReactNode
}

export function DropZoneDescription({
  className,
  ...props
}: DropZoneDescriptionProps) {
  return (
    <div
      data-slot="drop-zone-description"
      {...props}
      className={styles.DropZoneDescription(styler.merge({className}))}
    />
  )
}

function acceptsTypes(
  accept: Array<string> | undefined,
  types: {has(type: string): boolean}
) {
  if (!accept || accept.length === 0) return true
  return accept.some(
    // Wildcards and extensions can only be checked once the files are dropped
    type => type.startsWith('.') || type.endsWith('/*') || types.has(type)
  )
}

function acceptsFile(accept: Array<string> | undefined, file: File) {
  if (!accept || accept.length === 0) return true
  const name = file.name.toLowerCase()
  const mime = file.type.toLowerCase()
  return accept.some(pattern => {
    const type = pattern.trim().toLowerCase()
    if (type.startsWith('.')) return name.endsWith(type)
    if (type.endsWith('/*')) return mime.startsWith(type.slice(0, -1))
    return mime === type
  })
}
