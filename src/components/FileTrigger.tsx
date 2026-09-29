import {
  cloneElement,
  isValidElement,
  type MouseEvent,
  type ReactNode,
  useRef
} from 'react'
import {acceptsFile} from './internal/Accept.js'

export interface FileTriggerProps {
  /** Called with the picked files that match `accept`, never with an empty list */
  onSelect: (files: Array<File>) => void
  /**
   * Accepted mime types (`image/png`, `image/*`) or file extensions (`.pdf`),
   * every file is accepted if left out
   */
  accept?: Array<string>
  /** Allow picking more than one file */
  multiple?: boolean
  /** Pick a directory, every file in it is selected */
  directory?: boolean
  /**
   * The element that opens the file browser when clicked, eg. a Button. Call
   * `preventDefault()` in its `onClick` to keep the file browser closed.
   */
  children: ReactNode
}

interface TriggerProps {
  onClick?: (event: MouseEvent<HTMLElement>) => void
}

/** Opens the file browser when its child is clicked */
export function FileTrigger({
  onSelect,
  accept,
  multiple,
  directory,
  children
}: FileTriggerProps) {
  const input = useRef<HTMLInputElement>(null)
  // Not part of React's input attributes, spread so it's passed as is
  const directoryProps = directory ? {webkitdirectory: ''} : {}
  if (!isValidElement<TriggerProps>(children)) return null
  const trigger = cloneElement(children, {
    onClick(event: MouseEvent<HTMLElement>) {
      children.props.onClick?.(event)
      if (!event.defaultPrevented) input.current?.click()
    }
  })
  return (
    <>
      {trigger}
      <input
        data-slot="file-trigger-input"
        ref={input}
        type="file"
        hidden
        tabIndex={-1}
        accept={accept?.join(',')}
        multiple={multiple}
        {...directoryProps}
        onChange={event => {
          const files = Array.from(event.currentTarget.files ?? []).filter(
            file => acceptsFile(accept, file)
          )
          event.currentTarget.value = ''
          if (files.length > 0) onSelect(files)
        }}
      />
    </>
  )
}
