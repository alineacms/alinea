import {Switch} from '@headlessui/react'
import {Config, Workspace} from 'alinea/core'
import {entries, fromEntries} from 'alinea/core/util/Objects'
import {InputField} from 'alinea/editor/view/InputField'
import {select} from 'alinea/input'
import {HStack, Icon, VStack, fromModule, px} from 'alinea/ui'
import {DropdownMenu} from 'alinea/ui/DropdownMenu'
import {PopoverMenu} from 'alinea/ui/PopoverMenu'
import {IcBaselineAccountCircle} from 'alinea/ui/icons/IcBaselineAccountCircle'
import {IcRoundKeyboardArrowDown} from 'alinea/ui/icons/IcRoundKeyboardArrowDown'
import {IcRoundKeyboardArrowUp} from 'alinea/ui/icons/IcRoundKeyboardArrowUp'
import {IcRoundTextFields} from 'alinea/ui/icons/IcRoundTextFields'
import {IcSharpBrightnessMedium} from 'alinea/ui/icons/IcSharpBrightnessMedium'
import {parseToHsla} from 'color2k'
import {useAtomValue, useSetAtom} from 'jotai'
import {dashboardOptionsAtom} from '../../atoms/DashboardAtoms.js'
import {
  preferencesAtom,
  sizePreferenceAtom,
  toggleSchemePreferenceAtom,
  workspacePreferenceAtom
} from '../../atoms/PreferencesAtoms.js'
import {accentColorAtom} from '../../atoms/StyleAtoms.js'
import {useSession} from '../../hook/UseSession.js'
import {IconButton} from '../IconButton.js'
import {Sidebar} from '../Sidebar.js'
import css from './SidebarSettings.module.scss'

const styles = fromModule(css)

export function SidebarSettings() {
  const accentColor = useAtomValue(accentColorAtom)
  const session = useSession()
  const {config} = useAtomValue(dashboardOptionsAtom)
  const preferences = useAtomValue(preferencesAtom)
  const size = preferences.size || 16
  const checked = preferences?.scheme === 'dark'
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
    <DropdownMenu.Root style={{marginTop: 'auto', ...style}}>
      <DropdownMenu.Trigger style={{width: '100%'}}>
        <Sidebar.Nav.Item aria-label="Settings">
          <Icon icon={IcBaselineAccountCircle} />
        </Sidebar.Nav.Item>
      </DropdownMenu.Trigger>

      <DropdownMenu.Items placement="top" style={{left: px(16)}}>
        <VStack gap={10}>
          <VStack gap={15}>
            <HStack justify={'space-between'} style={{padding: px(6)}}>
              <HStack center gap={16}>
                <Icon icon={IcSharpBrightnessMedium} size={20} />
                <Switch
                  checked={checked}
                  onChange={() => {
                    document.body.setAttribute(
                      'data-disable-transition',
                      'true'
                    )
                    toggleSchemePreference()
                    setTimeout(() =>
                      document.body.removeAttribute('data-disable-transition')
                    )
                  }}
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
            {workspaces.length > 1 && (
              <InputField
                value={preferences.workspace || ''}
                onChange={v => updateWorkspace(v ?? undefined)}
                field={defaultWorkspace}
              />
            )}
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
      </DropdownMenu.Items>
    </DropdownMenu.Root>
  )
}
