import styler from '@alinea/styler'
import {Allotment, type AllotmentHandle, LayoutPriority} from 'allotment'
import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef
} from 'react'
import css from './Resizable.module.css'
import type {AriaProps, DataProps, Orientation, StyleProps} from './types.js'

const styles = styler(css)

export interface ResizablePanelGroupProps
  extends StyleProps, AriaProps, DataProps {
  /** The axis the panels are laid out on, defaults to horizontal */
  direction?: Orientation
  /** The size of every panel in px, after the user resized them */
  onLayout?: (sizes: Array<number>) => void
  /** ResizablePanel elements separated by ResizableHandle elements */
  children: ReactNode
}

export interface ResizablePanelProps extends StyleProps, AriaProps, DataProps {
  /** Size in px on mount, and the size restored by double clicking a handle */
  defaultSize?: number
  /**
   * Size in px, eg. a stored preference. The panel is resized when it
   * changes. Leave both sizes off to let the panel fill the remaining space.
   */
  size?: number
  /** Called with the new size in px after the user resized the panel */
  onSizeChange?: (size: number) => void
  minSize?: number
  maxSize?: number
  /** Hide the panel without unmounting its children, defaults to true */
  visible?: boolean
  /**
   * Panels with a higher priority grow and shrink first when the group is
   * resized, defaults to normal
   */
  priority?: 'low' | 'normal' | 'high'
  children: ReactNode
}

export interface ResizableHandleProps {
  /** Shows a grip on the divider */
  withHandle?: boolean
}

const priorities = {
  low: LayoutPriority.Low,
  normal: LayoutPriority.Normal,
  high: LayoutPriority.High
}

const rank = {high: 0, normal: 1, low: 2}

type PanelElement = ReactElement<ResizablePanelProps>
type HandleElement = ReactElement<ResizableHandleProps>

function isPanel(node: ReactNode): node is PanelElement {
  return isValidElement(node) && node.type === ResizablePanel
}

function isHandle(node: ReactNode): node is HandleElement {
  return isValidElement(node) && node.type === ResizableHandle
}

function sum(sizes: Array<number>) {
  return sizes.reduce((total, size) => total + size, 0)
}

/**
 * Lays out ResizablePanel children next to each other, with a draggable
 * divider between them. Sizes are in px. Panels must be direct children, give
 * them a `key` when they are rendered conditionally.
 */
export function ResizablePanelGroup({
  direction = 'horizontal',
  onLayout,
  className,
  children,
  ...props
}: ResizablePanelGroupProps) {
  const root = useRef<HTMLDivElement>(null)
  const allotment = useRef<AllotmentHandle>(null)
  const nodes = Children.toArray(children)
  const panels = nodes.filter(isPanel)
  const handles = nodes.filter(isHandle)
  const latest = useRef({panels, handles, onLayout})
  const dragStart = useRef<Array<number>>([])
  const sizes = useRef(new Map<string, number | undefined>())
  const vertical = direction === 'vertical'

  useLayoutEffect(() => {
    latest.current = {panels, handles, onLayout}
  })

  function views() {
    const container = root.current?.querySelector(
      ':scope > .split-view > .split-view-container'
    )
    return Array.from(container?.children ?? []) as Array<HTMLElement>
  }

  function measure() {
    return views().map(view => {
      const bounds = view.getBoundingClientRect()
      return vertical ? bounds.height : bounds.width
    })
  }

  // Resize some panels and hand the difference to the panel that grows first
  function resize(targets: Map<number, number>) {
    const {panels} = latest.current
    const current = measure()
    if (current.length !== panels.length) return current
    const next = [...current]
    for (const [index, size] of targets) next[index] = size
    const flexible = panels
      .map((panel, index) => ({panel, index}))
      .filter(
        ({panel, index}) => !targets.has(index) && panel.props.visible !== false
      )
      .sort(
        (a, b) =>
          rank[a.panel.props.priority ?? 'normal'] -
          rank[b.panel.props.priority ?? 'normal']
      )
    if (flexible.length > 0) next[flexible[0].index] += sum(current) - sum(next)
    allotment.current?.resize(next)
    return measure()
  }

  function reset() {
    const {panels, onLayout} = latest.current
    const targets = new Map<number, number>()
    panels.forEach((panel, index) => {
      const {defaultSize, visible} = panel.props
      if (defaultSize !== undefined && visible !== false)
        targets.set(index, defaultSize)
    })
    if (targets.size === 0) {
      const visible = panels.filter(panel => panel.props.visible !== false)
      const size = sum(measure()) / Math.max(visible.length, 1)
      panels.forEach((panel, index) => {
        if (panel.props.visible !== false) targets.set(index, size)
      })
    }
    const next = resize(targets)
    for (const index of targets.keys())
      panels[index].props.onSizeChange?.(next[index])
    onLayout?.(next)
  }

  function dragEnd(next: Array<number>) {
    const {panels, onLayout} = latest.current
    panels.forEach((panel, index) => {
      const size = next[index]
      if (panel.props.visible === false || !(size > 0)) return
      if (size !== dragStart.current[index]) panel.props.onSizeChange?.(size)
    })
    onLayout?.(next)
  }

  // Follow changes to the controlled size of panels
  useLayoutEffect(() => {
    const previous = sizes.current
    const changed = panels.flatMap((panel, index) => {
      const {size, visible} = panel.props
      const key = String(panel.key)
      if (
        size === undefined ||
        visible === false ||
        !previous.has(key) ||
        previous.get(key) === size
      )
        return []
      return [{index, size}]
    })
    sizes.current = new Map(
      panels.map(panel => [String(panel.key), panel.props.size])
    )
    // Only measure the panes once a controlled size actually changed
    if (changed.length === 0) return
    const current = measure()
    const targets = new Map<number, number>()
    for (const {index, size} of changed)
      if (current[index] !== size) targets.set(index, size)
    if (targets.size > 0) resize(targets)
  })

  // Allotment renders the dividers itself, mark them as our handles. New
  // dividers are picked up by the observer below.
  const handleLayout = handles
    .map(handle => (handle.props.withHandle ? 'grip' : 'plain'))
    .join()
  useLayoutEffect(() => {
    decorate()
  }, [handleLayout])
  useEffect(() => {
    const container = root.current?.querySelector(
      ':scope > .split-view > .sash-container'
    )
    if (!container) return
    const observer = new MutationObserver(decorate)
    observer.observe(container, {childList: true})
    return () => observer.disconnect()
  }, [])

  function decorate() {
    const sashes = root.current?.querySelectorAll<HTMLElement>(
      ':scope > .split-view > .sash-container > .sash'
    )
    sashes?.forEach((sash, index) => {
      const handle = latest.current.handles[index]
      sash.dataset.slot = 'resizable-handle'
      if (handle?.props.withHandle) sash.dataset.withHandle = ''
      else delete sash.dataset.withHandle
    })
  }

  return (
    <div
      data-slot="resizable-panel-group"
      {...props}
      ref={root}
      data-direction={direction}
      className={styles.ResizablePanelGroup(styler.merge({className}))}
    >
      <Allotment
        ref={allotment}
        vertical={vertical}
        proportionalLayout={false}
        defaultSizes={panels.map(
          panel =>
            panel.props.size ??
            panel.props.defaultSize ??
            Math.max(panel.props.minSize ?? 0, 100)
        )}
        onDragStart={next => {
          dragStart.current = next
        }}
        onDragEnd={dragEnd}
        onReset={reset}
      >
        {panels.map(panel => (
          <Allotment.Pane
            key={panel.key}
            className={styles.ResizablePanelGroup.view()}
            minSize={panel.props.minSize ?? 0}
            maxSize={panel.props.maxSize ?? Infinity}
            preferredSize={panel.props.size ?? panel.props.defaultSize}
            priority={priorities[panel.props.priority ?? 'normal']}
            visible={panel.props.visible !== false}
          >
            {panel}
          </Allotment.Pane>
        ))}
      </Allotment>
    </div>
  )
}

/** A panel of a ResizablePanelGroup */
export function ResizablePanel({
  defaultSize: _defaultSize,
  size: _size,
  onSizeChange: _onSizeChange,
  minSize: _minSize,
  maxSize: _maxSize,
  visible: _visible,
  priority: _priority,
  className,
  ...props
}: ResizablePanelProps) {
  return (
    <div
      data-slot="resizable-panel"
      {...props}
      className={styles.ResizablePanel(styler.merge({className}))}
    />
  )
}

/**
 * Marks the divider between two panels of a ResizablePanelGroup. Drag it to
 * resize the panels, double click it to restore their default sizes.
 */
export function ResizableHandle(_props: ResizableHandleProps) {
  return null
}
