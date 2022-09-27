import {fromModule, Pane, useNonInitialEffect} from '@alinea/ui'
import {Badge} from '@alinea/ui/Badge'
import {link} from '@alinea/ui/util/HashRouter'
import {createSlots} from '@alinea/ui/util/Slots'
import {useWindowWidth} from '@react-hook/window-size'
import {
  createContext,
  Dispatch,
  HTMLProps,
  PropsWithChildren,
  useContext,
  useReducer
} from 'react'
import {useEntryLocation} from '../hook/UseEntryLocation'
import {useWorkspace} from '../hook/UseWorkspace'
import css from './Sidebar.module.scss'

const styles = fromModule(css)

type Opened = {nav: boolean; preview: boolean}
type OpenContext = [Opened, Dispatch<keyof Opened>]

export namespace Sidebar {
  // export const Root = styles.root.toElement('aside')

  const slots = createSlots()
  const opened = createContext<OpenContext | undefined>(undefined)

  export function use() {
    const [open, toggleOpen] = useContext(opened)!
    return {
      isNavOpen: open.nav,
      isPreviewOpen: open.preview,
      toggleNav: () => toggleOpen('nav'),
      togglePreview: () => toggleOpen('preview')
    }
  }

  function simpleToggle(
    open: Opened,
    toggle: keyof Opened | Partial<Opened>
  ): Opened {
    if (typeof toggle === 'string') return {...open, [toggle]: !open[toggle]}
    return {...open, ...toggle}
  }

  function uniqueToggle(
    open: Opened,
    toggle: keyof Opened | Partial<Opened>
  ): Opened {
    const empty = {nav: false, preview: false}
    if (typeof toggle === 'string') return {...empty, [toggle]: !open[toggle]}
    return {...empty, ...toggle}
  }

  export function Provider({children}: PropsWithChildren<{}>) {
    const innerWidth = useWindowWidth()
    const isLarge = innerWidth >= 1024
    const isSmall = innerWidth < 768
    const [open, dispatchOpen] = useReducer(
      isLarge ? simpleToggle : uniqueToggle,
      {nav: true, preview: isLarge}
    )
    const {id} = useEntryLocation() || {}
    const {name: workspace} = useWorkspace()
    useNonInitialEffect(() => {
      if (!isSmall) return
      if (id) dispatchOpen({nav: false})
    }, [isSmall, id])

    useNonInitialEffect(() => {
      if (!isSmall) return
      dispatchOpen({nav: true})
    }, [isSmall, workspace])
    return (
      <slots.Provider>
        <opened.Provider value={[open, dispatchOpen]}>
          {children}
        </opened.Provider>
      </slots.Provider>
    )
  }

  export function Tree({children}: PropsWithChildren<{}>) {
    return (
      <slots.Slot>
        <Pane
          id="content-tree"
          resizable="right"
          defaultWidth={300}
          minWidth={200}
        >
          {children}
        </Pane>
      </slots.Slot>
    )
  }

  export function Preview({children}: PropsWithChildren<{}>) {
    const {isPreviewOpen, togglePreview} = use()
    return (
      <div className={styles.collapse('right', {open: isPreviewOpen})}>
        <div className={styles.collapse.overlay()} onClick={togglePreview} />
        <Pane id="preview" resizable="left" className={styles.collapse.inner()}>
          {children}
        </Pane>
      </div>
    )
  }

  export function Nav({children}: PropsWithChildren<{}>) {
    const {isNavOpen, toggleNav} = use()
    return (
      <div className={styles.collapse('left', {open: isNavOpen})}>
        <div className={styles.collapse.overlay()} onClick={toggleNav} />
        <div className={styles.collapse.inner()}>
          <nav className={styles.root.menu()}>{children}</nav>
          <slots.Portal />
        </div>
      </div>
    )
  }

  export namespace Nav {
    export type ItemProps = PropsWithChildren<
      HTMLProps<HTMLAnchorElement> & {selected?: boolean; badge?: number}
    >
    export function Item({children, selected, badge, ...props}: ItemProps) {
      return (
        <a
          {...props}
          {...link(props.href)}
          className={styles.root.menu.item.mergeProps(props)({selected})}
        >
          <Badge amount={badge} right={-4} bottom={-3}>
            {children}
          </Badge>
        </a>
      )
    }
  }
}

export const useSidebar = Sidebar.use
