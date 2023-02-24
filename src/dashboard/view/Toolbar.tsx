import {Switch} from '@headlessui/react'
import {Label} from 'alinea/core/Label'
import {InputField} from 'alinea/editor/view/InputField'
import {select} from 'alinea/input/select'
import {
  Avatar,
  DropdownMenu,
  fromModule,
  Icon,
  IconButton,
  LogoShape,
  px,
  TextLabel,
  usePreferences,
  VStack
} from 'alinea/ui'
import {IcOutlineScreenshot} from 'alinea/ui/icons/IcOutlineScreenshot'
import IcRoundKeyboardArrowDown from 'alinea/ui/icons/IcRoundKeyboardArrowDown'
import IcRoundKeyboardArrowUp from 'alinea/ui/icons/IcRoundKeyboardArrowUp'
import {IcRoundMenu} from 'alinea/ui/icons/IcRoundMenu'
import IcRoundTextFields from 'alinea/ui/icons/IcRoundTextFields'
import {IcRoundUnfoldMore} from 'alinea/ui/icons/IcRoundUnfoldMore'
import {IcSharpBrightnessMedium} from 'alinea/ui/icons/IcSharpBrightnessMedium'
import {PopoverMenu} from 'alinea/ui/PopoverMenu'
import {HStack} from 'alinea/ui/Stack'
import {contrastColor} from 'alinea/ui/util/ContrastColor'
import {link, useNavigate} from 'alinea/ui/util/HashRouter'
import {createSlots} from 'alinea/ui/util/Slots'
import {parseToHsla} from 'color2k'
import {ComponentType} from 'react'
import {useDashboard} from '../hook/UseDashboard.js'
import {useNav} from '../hook/UseNav.js'
import {useSession} from '../hook/UseSession.js'
import {useWorkspace} from '../hook/UseWorkspace.js'
import {useSidebar} from './Sidebar.js'
import css from './Toolbar.module.scss'

const styles = fromModule(css)

type ToolbarProps = {
  color: string
}
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

  export function Root({color}: ToolbarProps) {
    const accentColor = color!
    const session = useSession()
    const {config} = useDashboard()
    const nav = useNav()
    const preferences = usePreferences()
    const size = preferences.size || 16
    const checked = preferences?.scheme === 'dark'
    const workspace = useWorkspace()
    const navigate = useNavigate()
    const {isNavOpen, isPreviewOpen, toggleNav, togglePreview} = useSidebar()
    const workspaces = Object.entries(config.workspaces)
    const [hue, saturation, lightness] = parseToHsla(accentColor)
    const style: any = {
      '--alinea-hue': hue,
      '--alinea-saturation': `${saturation * 100}%`,
      '--alinea-lightness': `${lightness * 100}%`
    }
    const defaultWorkspace = select(
      'Default workspace',
      Object.fromEntries(
        Object.entries(config.workspaces).map(([key, workspace]) => {
          return [key, (workspace.label as string) || key]
        })
      )
    )
    return (
      <HStack center gap={12} className={styles.root()} style={style}>
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
          <a
            {...link(nav.root({workspace: workspace.name}))}
            className={styles.root.workspace()}
          >
            <WorkspaceLabel
              label={workspace.label}
              color={workspace.color}
              icon={workspace.icon}
            />
          </a>
        )}

        <div className={styles.root.portal()}>
          <Portal className={styles.root.portal.slot()} />
        </div>
        <div>
          <HStack center gap={10}>
            <PopoverMenu.Root>
              <PopoverMenu.Trigger>
                <HStack center gap={4}>
                  <Avatar user={session.user} />
                  <IcRoundKeyboardArrowDown />
                </HStack>
              </PopoverMenu.Trigger>

              <PopoverMenu.Items right>
                <VStack gap={25}>
                  {config.hasAuth && (
                    <PopoverMenu.Header>
                      <p>
                        {session.user.sub.charAt(0).toUpperCase() +
                          session.user.sub.slice(1)}
                      </p>
                    </PopoverMenu.Header>
                  )}

                  <VStack gap={15}>
                    <HStack justify={'space-between'} style={{padding: px(6)}}>
                      <HStack center gap={16}>
                        <Icon icon={IcSharpBrightnessMedium} size={20} />
                        <Switch
                          checked={checked}
                          onChange={preferences.toggleColorScheme}
                          className={styles.root.switch({
                            checked
                          })}
                        >
                          <span
                            className={styles.root.switch.slider({
                              checked
                            })}
                          />
                        </Switch>
                      </HStack>
                      <HStack gap={4}>
                        <Icon
                          icon={IcRoundTextFields}
                          size={20}
                          style={{marginRight: px(12)}}
                        />
                        <IconButton
                          icon={IcRoundKeyboardArrowDown}
                          onClick={() => preferences.updateFontSize(size - 1)}
                          disabled={size <= 16}
                        />
                        <IconButton
                          icon={IcRoundKeyboardArrowUp}
                          onClick={() => preferences.updateFontSize(size + 1)}
                          disabled={size >= 40}
                        />
                      </HStack>
                    </HStack>
                    {workspaces.length > 1 && (
                      <InputField
                        value={preferences.workspace || ''}
                        onChange={preferences.setWorkspace}
                        field={defaultWorkspace}
                      />
                    )}
                  </VStack>

                  {config.hasAuth && (
                    <PopoverMenu.Footer>
                      <DropdownMenu.Root>
                        <DropdownMenu.Item onClick={session.end}>
                          Logout
                        </DropdownMenu.Item>
                      </DropdownMenu.Root>
                    </PopoverMenu.Footer>
                  )}
                </VStack>
              </PopoverMenu.Items>
            </PopoverMenu.Root>
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
