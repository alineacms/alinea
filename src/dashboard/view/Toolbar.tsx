import {Switch} from '@headlessui/react'
import {Root as AlineaRoot, Config, Workspace} from 'alinea/core'
import {Label} from 'alinea/core/Label'
import {entries, fromEntries} from 'alinea/core/util/Objects'
import {link, useNavigate} from 'alinea/dashboard/util/HashRouter'
import {select} from 'alinea/field/select'
import {Icon, TextLabel, VStack, fromModule, px} from 'alinea/ui'
import {Avatar} from 'alinea/ui/Avatar'
import {DropdownMenu} from 'alinea/ui/DropdownMenu'
import {PopoverMenu} from 'alinea/ui/PopoverMenu'
import {HStack} from 'alinea/ui/Stack'
import {LogoShape} from 'alinea/ui/branding/LogoShape'
import {IcOutlineScreenshot} from 'alinea/ui/icons/IcOutlineScreenshot'
import {IcRoundKeyboardArrowDown} from 'alinea/ui/icons/IcRoundKeyboardArrowDown'
import {IcRoundKeyboardArrowUp} from 'alinea/ui/icons/IcRoundKeyboardArrowUp'
import {IcRoundMenu} from 'alinea/ui/icons/IcRoundMenu'
import {IcRoundTextFields} from 'alinea/ui/icons/IcRoundTextFields'
import {IcRoundUnfoldMore} from 'alinea/ui/icons/IcRoundUnfoldMore'
import {IcSharpBrightnessMedium} from 'alinea/ui/icons/IcSharpBrightnessMedium'
import {RiFlashlightFill} from 'alinea/ui/icons/RiFlashlightFill'
import {contrastColor} from 'alinea/ui/util/ContrastColor'
import {createSlots} from 'alinea/ui/util/Slots'
import {parseToHsla} from 'color2k'
import {useAtomValue, useSetAtom} from 'jotai'
import {ComponentType} from 'react'
import {dashboardOptionsAtom} from '../atoms/DashboardAtoms.js'
import {navAtom, workspaceAtom} from '../atoms/NavigationAtoms.js'
import {
  preferencesAtom,
  sizePreferenceAtom,
  toggleSchemePreferenceAtom,
  workspacePreferenceAtom
} from '../atoms/PreferencesAtoms.js'
import {accentColorAtom} from '../atoms/StyleAtoms.js'
import {useSession} from '../hook/UseSession.js'
import {AlineaLogo} from './AlineaLogo.js'
import {IconButton} from './IconButton.js'
import {useSidebar} from './Sidebar.js'
import css from './Toolbar.module.scss'

const styles = fromModule(css)

type WorkspaceLabelProps = {
  color?: string
  label: Label
  icon?: ComponentType
}

function WorkspaceLabel({label, color, icon: Icon}: WorkspaceLabelProps) {
  const symbol = Icon ? <Icon /> : <RiFlashlightFill />
  return (
    <HStack center gap={12}>
      <LogoShape foreground={contrastColor(color)} background={color}>
        <AlineaLogo />
      </LogoShape>
      <div style={{fontSize: '13px', fontWeight: 600}}>
        <TextLabel label={label} />
      </div>
    </HStack>
  )
}

export namespace Toolbar {
  export const {Provider, Portal, Slot} = createSlots()

  export function Root() {
    const accentColor = useAtomValue(accentColorAtom)
    const session = useSession()
    const {config} = useAtomValue(dashboardOptionsAtom)
    const nav = useAtomValue(navAtom)
    const preferences = useAtomValue(preferencesAtom)
    const size = preferences.size || 16
    const checked = preferences?.scheme === 'dark'
    const workspace = useAtomValue(workspaceAtom)
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
      fromEntries(
        entries(config.workspaces).map(([key, workspace]) => {
          return [key, (Workspace.label(workspace) as string) || key]
        })
      )
    )
    const toggleSchemePreference = useSetAtom(toggleSchemePreferenceAtom)
    const updateFontSize = useSetAtom(sizePreferenceAtom)
    const updateWorkspace = useSetAtom(workspacePreferenceAtom)
    return (
      <HStack center gap={12} className={styles.root()} style={style}>
        <div className={styles.root.menu()} onClick={toggleNav}>
          <IconButton icon={IcRoundMenu} active={isNavOpen} />
        </div>

        {workspaces.length > 1 ? (
          <DropdownMenu.Root bottom>
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
                          locale: AlineaRoot.defaultLocale(root)
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
                  {Config.hasAuth(config) && (
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
                          onChange={toggleSchemePreference}
                          className={styles.root.switch({checked})}
                        >
                          <span
                            className={styles.root.switch.slider({
                              checked
                            })}
                          />
                        </Switch>
                      </HStack>
                      <HStack center gap={4}>
                        <Icon
                          icon={IcRoundTextFields}
                          size={20}
                          style={{marginRight: px(12)}}
                        />
                        <IconButton
                          icon={IcRoundKeyboardArrowDown}
                          onClick={() => updateFontSize(size - 1)}
                          disabled={size <= 16}
                        />
                        <IconButton
                          icon={IcRoundKeyboardArrowUp}
                          onClick={() => updateFontSize(size + 1)}
                          disabled={size >= 40}
                        />
                      </HStack>
                    </HStack>
                    {/*workspaces.length > 1 && (
                      <InputField
                        value={preferences.workspace || ''}
                        onChange={v => updateWorkspace(v ?? undefined)}
                        field={defaultWorkspace}
                      />
                    )*/}
                  </VStack>

                  {Config.hasAuth(config) && (
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
