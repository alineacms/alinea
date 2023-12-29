import {
  HTMLAttributes,
  MouseEvent as ReactMouseEvent,
  RefObject,
  useRef
} from 'react'
import css from './Pane.module.scss'
import {fromModule} from './util/Styler.js'

const styles = fromModule(css)

type DividerProps = {
  direction: 1 | -1
  container: RefObject<HTMLDivElement>
  defaultWidth: number
  minWidth: number
  maxWidth: number
  width: number
  setWidth: (width: number) => void
  position: 'left' | 'right'
}

function Divider({
  position,
  direction,
  container,
  defaultWidth,
  minWidth,
  maxWidth,
  width,
  setWidth
}: DividerProps) {
  function ignoreIframes() {
    const iframes = document.querySelectorAll('iframe')
    for (const iframe of iframes) iframe.style.pointerEvents = 'none'
    return () => {
      for (const iframe of iframes) iframe.style.pointerEvents = ''
    }
  }
  const draggingClassName = 'is-dragging'
  function handleMouseDown(mouseDownEvent: ReactMouseEvent) {
    container.current?.classList.add(draggingClassName)
    let prevX = mouseDownEvent.clientX
    const restoreIframes = ignoreIframes()
    function move(moveEvent: MouseEvent) {
      moveEvent.preventDefault()
      if (!container?.current) return
      let newWidth = width + (moveEvent.clientX - prevX) * direction
      if (newWidth < minWidth) newWidth = minWidth
      else if (newWidth > maxWidth) newWidth = maxWidth
      else prevX = moveEvent.clientX
      width = newWidth
      container.current.style.width = `${newWidth}px`
      setWidth(newWidth)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener(
      'mouseup',
      function () {
        container.current?.classList.remove(draggingClassName)
        window.removeEventListener('mousemove', move)
        restoreIframes()
      },
      {once: true}
    )
  }
  return (
    <div
      className={styles.divider(position)}
      onDoubleClick={e => {
        e.preventDefault()
        width = defaultWidth
        setWidth(defaultWidth)
        container.current!.style.width = `${defaultWidth}px`
      }}
    >
      <div className={styles.divider.handle()} onMouseDown={handleMouseDown}>
        <div className={styles.divider.handle.line()} />
      </div>
    </div>
  )
}

export type PaneProps = {
  id: string
  defaultWidth?: number
  minWidth?: number
  maxWidth?: number
  resizable: 'left' | 'right'
} & HTMLAttributes<HTMLDivElement>

export function Pane({
  id,
  children,
  resizable,
  defaultWidth = 320,
  minWidth = 320,
  maxWidth = 1200,
  ...props
}: PaneProps) {
  const container = useRef<HTMLDivElement>(null)
  const persistenceId = `@alinea/ui/pane-${id}`
  const width =
    Number(window?.localStorage?.getItem(persistenceId)) || defaultWidth
  const divider = (
    <Divider
      position={resizable}
      container={container}
      minWidth={minWidth}
      maxWidth={maxWidth}
      defaultWidth={defaultWidth}
      direction={resizable === 'left' ? -1 : 1}
      width={Math.max(width, minWidth)}
      setWidth={(width: number) => {
        window?.localStorage?.setItem(persistenceId, String(width))
      }}
    />
  )
  return (
    <div
      {...props}
      className={styles.root.mergeProps(props)()}
      ref={container}
      style={{width, minWidth}}
    >
      {resizable === 'left' && divider}
      <div className={styles.root.inner()}>{children}</div>
      {resizable === 'right' && divider}
    </div>
  )
}
