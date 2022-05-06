import {
  HTMLAttributes,
  MouseEvent as ReactMouseEvent,
  RefObject,
  useRef
} from 'react'
import css from './Pane.module.scss'
import {fromModule} from './util/Styler'

const styles = fromModule(css)

type DividerProps = {
  direction: 1 | -1
  container: RefObject<HTMLDivElement>
  defaultWidth: number
  minWidth: number
  persistWidth: (width: number) => void
}

function Divider({
  direction,
  container,
  defaultWidth,
  minWidth,
  persistWidth
}: DividerProps) {
  const width = useRef(defaultWidth)
  function handleMouseDown(mouseDownEvent: ReactMouseEvent) {
    let prevX = mouseDownEvent.clientX
    function move(moveEvent: MouseEvent) {
      moveEvent.preventDefault()
      const newWidth = width.current + (moveEvent.clientX - prevX) * direction
      if (newWidth < minWidth) return
      prevX = moveEvent.clientX
      width.current = newWidth
      persistWidth(newWidth)
      if (!container?.current) return
      container.current.style.width = `${width.current}px`
    }
    window.addEventListener('mousemove', move)
    window.addEventListener(
      'mouseup',
      function () {
        window.removeEventListener('mousemove', move)
      },
      {once: true}
    )
  }
  return (
    <div
      className={styles.divider()}
      onDoubleClick={e => {
        e.preventDefault()
        width.current = 330
        persistWidth(330)
        if (!container?.current) return
        container.current.style.width = `${330}px`
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
  defaultWidth: number
  minWidth?: number
  resizable: 'left' | 'right'
} & HTMLAttributes<HTMLDivElement>

export function Pane({
  id,
  children,
  resizable,
  defaultWidth,
  minWidth = 100,
  ...props
}: PaneProps) {
  const container = useRef<HTMLDivElement>(null)
  const persistenceId = `@alinea/ui/pane-${id}`
  const width =
    Number(window?.localStorage?.getItem(persistenceId)) || defaultWidth
  const divider = (
    <Divider
      container={container}
      minWidth={minWidth}
      defaultWidth={width}
      direction={resizable === 'left' ? -1 : 1}
      persistWidth={(width: number) => {
        window?.localStorage?.setItem(persistenceId, String(width))
      }}
    />
  )
  return (
    <div {...props} className={styles.root.mergeProps(props)()}>
      {resizable === 'left' && divider}
      <div
        ref={container}
        style={{width, minWidth}}
        className={styles.root.inner()}
      >
        {children}
      </div>
      {resizable === 'right' && divider}
    </div>
  )
}
