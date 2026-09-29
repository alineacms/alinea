import styler from '@alinea/styler'
import {createContext, type ReactNode, useContext} from 'react'
import {
  DropZone as DropZonePrimitive,
  isFileDropItem
} from 'react-aria-components'
import {Button, type ButtonProps} from './Button.js'
import css from './DropZone.module.css'
import {FileTrigger} from './FileTrigger.js'
import {acceptsFile} from './internal/Accept.js'
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
        isDisabled={disabled}
        className={({isDropTarget}) =>
          styles.DropZone(
            {dropTarget: isDropTarget, disabled},
            styler.merge({className})
          )
        }
        getDropOperation={types =>
          acceptsTypes(accept, types) ? 'copy' : 'cancel'
        }
        onDrop={async event => {
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
export function DropZoneTrigger({disabled, ...props}: DropZoneTriggerProps) {
  const context = useContext(DropZoneContext)
  if (!context) throw new Error('DropZoneTrigger must be used in a DropZone')
  return (
    <FileTrigger
      accept={context.accept}
      multiple={context.multiple}
      onSelect={context.onDropFiles}
    >
      <Button
        data-slot="drop-zone-trigger"
        {...props}
        disabled={disabled || context.disabled}
      />
    </FileTrigger>
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
