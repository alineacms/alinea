import {Label} from '@alinea/core/Label'
import {
  Avatar,
  DropdownMenu,
  fromModule,
  Icon,
  IconButton,
  TextLabel,
  useColorScheme
} from '@alinea/ui'
import {LogoShape} from '@alinea/ui/branding/LogoShape'
import {IcOutlineScreenshot} from '@alinea/ui/icons/IcOutlineScreenshot'
import {IcRoundKeyboardArrowDown} from '@alinea/ui/icons/IcRoundKeyboardArrowDown'
import {IcRoundMenu} from '@alinea/ui/icons/IcRoundMenu'
import {IcRoundUnfoldMore} from '@alinea/ui/icons/IcRoundUnfoldMore'
import {IcSharpBrightnessMedium} from '@alinea/ui/icons/IcSharpBrightnessMedium'
import {HStack} from '@alinea/ui/Stack'
import {contrastColor} from '@alinea/ui/util/ContrastColor'
import {createSlots} from '@alinea/ui/util/Slots'
import {ComponentType} from 'react'
import {useNavigate} from 'react-router'
import {Link} from 'react-router-dom'
import {useDashboard} from '../hook/UseDashboard'
import {useNav} from '../hook/UseNav'
import {useSession} from '../hook/UseSession'
import {useWorkspace} from '../hook/UseWorkspace'
import {useSidebar} from './Sidebar'
import css from './Toolbar.module.scss'

const styles = fromModule(css)

type WorkspaceLabelProps = {
  color?: string
  label: Label
  icon?: ComponentType
}

function WorkspaceLabel({label, color, icon: Icon}: WorkspaceLabelProps) {
  const symbol = Icon ? (
    <Icon />
  ) : (
    <span>{String(label).charAt(0).toUpperCase()}</span>
  )
  return (
    <HStack center gap={12}>
      <LogoShape foreground={contrastColor(color)} background={color}>
        {symbol}
      </LogoShape>
      <div style={{fontSize: '13px'}}>
        <TextLabel label={label} />
      </div>
    </HStack>
  )
}

export namespace Toolbar {
  export const {Provider, Portal, Slot} = createSlots()

  export function Root() {
    const session = useSession()
    const {config} = useDashboard()
    const nav = useNav()
    const [colorScheme, toggleColorScheme] = useColorScheme()
    const workspace = useWorkspace()
    const navigate = useNavigate()
    const {isNavOpen, isPreviewOpen, toggleNav, togglePreview} = useSidebar()
    const workspaces = Object.entries(config.workspaces)
    return (
      <HStack center gap={12} className={styles.root()}>
        <div className={styles.root.menu()} onClick={toggleNav}>
          <IconButton icon={IcRoundMenu} active={isNavOpen} />
        </div>

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

            <DropdownMenu.Items>
              {workspaces.map(([key, workspace]) => {
                const root = Object.values(workspace.roots)[0]
                return (
                  <DropdownMenu.Item
                    key={key}
                    onClick={() =>
                      navigate(
                        nav.entry({
                          workspace: key,
                          root: root.name,
                          locale: root.defaultLocale
                        })
                      )
                    }
                  >
                    <WorkspaceLabel
                      label={workspace.label}
                      color={workspace.color}
                      icon={workspace.icon}
                    />
                  </DropdownMenu.Item>
                )
              })}
            </DropdownMenu.Items>
          </DropdownMenu.Root>
        ) : (
          <Link
            to={nav.root({workspace: workspace.name})}
            className={styles.root.workspace()}
          >
            <WorkspaceLabel
              label={workspace.label}
              color={workspace.color}
              icon={workspace.icon}
            />
          </Link>
        )}

        <div className={styles.root.portal()}>
          <Portal className={styles.root.portal.slot()} />
        </div>
        <div>
          <HStack center gap={8}>
            <IconButton
              icon={IcSharpBrightnessMedium}
              onClick={toggleColorScheme}
            />
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <HStack center gap={4}>
                  <Avatar user={session.user} />
                  <IcRoundKeyboardArrowDown />
                </HStack>
              </DropdownMenu.Trigger>

              <DropdownMenu.Items>
                <DropdownMenu.Item onClick={session.end}>
                  Logout
                </DropdownMenu.Item>
              </DropdownMenu.Items>
            </DropdownMenu.Root>
            <IconButton
              icon={IcOutlineScreenshot}
              onClick={togglePreview}
              active={isPreviewOpen}
            />
          </HStack>
        </div>
      </HStack>
    )
  }
}
