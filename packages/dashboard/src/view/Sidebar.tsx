import {fromModule, Pane} from '@alinea/ui'
import {Badge} from '@alinea/ui/Badge'
import {createSlots} from '@alinea/ui/util/Slots'
import {
  createContext,
  Dispatch,
  PropsWithChildren,
  SetStateAction,
  useContext,
  useState
} from 'react'
import {Link, LinkProps} from 'react-router-dom'
import css from './Sidebar.module.scss'

const styles = fromModule(css)

type Opened = {nav: boolean; preview: boolean}
type OpenContext = [Opened, Dispatch<SetStateAction<Opened>>]

export namespace Sidebar {
  export const Root = styles.root.toElement('aside')

  const slots = createSlots()
  const opened = createContext<OpenContext | undefined>(undefined)

  export function useOpened() {
    const [open, setOpen] = useContext(opened)!
    return {
      isNavOpen: open.nav,
      isPreviewOpen: open.preview,
      toggleNav: () => setOpen({...open, nav: !open.nav}),
      togglePreview: () => setOpen({...open, preview: !open.preview})
    }
  }

  export function Provider({children}: PropsWithChildren<{}>) {
    const state = useState({nav: true, preview: true})
    return (
      <slots.Provider>
        <opened.Provider value={state}>{children}</opened.Provider>
      </slots.Provider>
    )
  }

  export function Tree({children}: PropsWithChildren<{}>) {
    return (
      <slots.Slot>
        <Pane
          id="content-tree"
          resizable="right"
          defaultWidth={330}
          minWidth={200}
        >
          {children}
        </Pane>
      </slots.Slot>
    )
  }

  export function Preview({children}: PropsWithChildren<{}>) {
    const {isPreviewOpen} = useOpened()
    if (!isPreviewOpen) return null
    return (
      <Pane id="preview" resizable="left">
        {children}
      </Pane>
    )
  }

  export function Nav({children}: PropsWithChildren<{}>) {
    const {isNavOpen} = useOpened()
    if (!isNavOpen) return null
    return (
      <>
        <nav className={styles.root.menu()}>{children}</nav>
        <slots.Portal />
      </>
    )
  }

  export namespace Nav {
    export type ItemProps = PropsWithChildren<
      LinkProps & {selected?: boolean; badge?: number}
    >
    export function Item({children, selected, badge, ...props}: ItemProps) {
      return (
        <Link
          {...props}
          className={styles.root.menu.item.mergeProps(props)({selected})}
        >
          <Badge amount={badge} right={-4} bottom={-3}>
            {children}
          </Badge>
        </Link>
      )
    }
  }
}

export const useSidebar = Sidebar.useOpened
