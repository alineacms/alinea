import {useWindowWidth} from '@react-hook/window-size'
import {Root, Workspace} from 'alinea/core'
import {entries} from 'alinea/core/util/Objects'
import {link, useNavigate} from 'alinea/dashboard/util/HashRouter'
import {HStack, Icon, Stack, fromModule} from 'alinea/ui'
import {Badge} from 'alinea/ui/Badge'
import {DropdownMenu} from 'alinea/ui/DropdownMenu'
import {Pane} from 'alinea/ui/Pane'
import {useNonInitialEffect} from 'alinea/ui/hook/UseNonInitialEffect'
import {IcRoundUnfoldMore} from 'alinea/ui/icons/IcRoundUnfoldMore'
import {createSlots} from 'alinea/ui/util/Slots'
import {
  Dispatch,
  HTMLProps,
  PropsWithChildren,
  createContext,
  useContext,
  useReducer
} from 'react'
import {useConfig} from '../hook/UseConfig.js'
import {useEntryLocation} from '../hook/UseEntryLocation.js'
import {useLocale} from '../hook/UseLocale.js'
import {useNav} from '../hook/UseNav.js'
import {useRoot} from '../hook/UseRoot.js'
import {useWorkspace} from '../hook/UseWorkspace.js'
import css from './Sidebar.module.scss'
import {WorkspaceLabel} from './WorkspaceLabel.js'
import {Langswitch} from './entry/LangSwitch.js'

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
    const {entryId: id} = useEntryLocation() || {}
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

  export function Tree({
    children,
    ...props
  }: PropsWithChildren<HTMLProps<HTMLElement>>) {
    return <slots.Slot>{children}</slots.Slot>
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

  function NavHeader() {
    const locale = useLocale()
    const config = useConfig()
    const workspace = useWorkspace()
    const root = useRoot()
    const workspaces = entries(config.workspaces)
    const navigate = useNavigate()
    const nav = useNav()
    const entryLocation = useEntryLocation()
    return (
      <HStack as="header" center gap={12} className={styles.navHeader()}>
        {workspaces.length > 1 ? (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              <HStack center gap={4}>
                <WorkspaceLabel
                  label={workspace.label}
                  color={workspace.color}
                  icon={workspace.icon}
                />
                <Icon icon={IcRoundUnfoldMore} />
              </HStack>
            </DropdownMenu.Trigger>

            <DropdownMenu.Items placement="bottom">
              {workspaces.map(([key, workspace]) => {
                const {roots, label, color, icon} = Workspace.data(workspace)
                const [name, root] = entries(roots)[0]
                return (
                  <DropdownMenu.Item
                    key={key}
                    onClick={() =>
                      navigate(
                        nav.entry({
                          workspace: key,
                          root: name,
                          locale: Root.defaultLocale(root)
                        })
                      )
                    }
                  >
                    <WorkspaceLabel label={label} color={color} icon={icon} />
                  </DropdownMenu.Item>
                )
              })}
            </DropdownMenu.Items>
          </DropdownMenu.Root>
        ) : (
          <a
            {...link(nav.root({workspace: workspace.name}))}
            className={styles.navHeader.workspace()}
          >
            <WorkspaceLabel
              label={workspace.label}
              color={workspace.color}
              icon={workspace.icon}
            />
          </a>
        )}
        <Stack.Right>
          {root.i18n && (
            <Langswitch
              selected={locale!}
              locales={root.i18n.locales}
              onChange={locale => {
                navigate(nav.entry({...entryLocation, locale}))
              }}
            />
          )}
        </Stack.Right>
      </HStack>
    )
  }
  export function Nav({children}: PropsWithChildren<{}>) {
    const {isNavOpen, toggleNav} = use()
    return (
      <div className={styles.collapse('left', {open: isNavOpen})}>
        <div className={styles.collapse.overlay()} onClick={toggleNav} />
        <Pane
          id="content-tree"
          resizable="right"
          defaultWidth={360}
          minWidth={200}
        >
          <div className={styles.nav.inner()}>
            <NavHeader />
            <div className={styles.nav.container()}>
              <nav className={styles.nav.menu()}>{children}</nav>
              <slots.Portal className={styles.nav.portal()} />
            </div>
          </div>
        </Pane>
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
          className={styles.nav.menu.item.mergeProps(props)({selected})}
        >
          <div className={styles.nav.menu.item.bg()}>
            <Badge amount={badge} right={-4} bottom={-3}>
              {children}
            </Badge>
          </div>
        </a>
      )
    }
  }
}

export const useSidebar = Sidebar.use
