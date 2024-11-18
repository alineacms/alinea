import styler from '@alinea/styler'
import {Switch} from '@headlessui/react'
import {Workspace} from 'alinea/core/Workspace'
import {entries, fromEntries} from 'alinea/core/util/Objects'
import {select} from 'alinea/field'
import {HStack, Icon, VStack, px} from 'alinea/ui'
import {DropdownMenu} from 'alinea/ui/DropdownMenu'
import {Ellipsis} from 'alinea/ui/Ellipsis'
import {PopoverMenu} from 'alinea/ui/PopoverMenu'
import {IcBaselineAccountCircle} from 'alinea/ui/icons/IcBaselineAccountCircle'
import {IcRoundKeyboardArrowDown} from 'alinea/ui/icons/IcRoundKeyboardArrowDown'
import {IcRoundKeyboardArrowUp} from 'alinea/ui/icons/IcRoundKeyboardArrowUp'
import {IcRoundTextFields} from 'alinea/ui/icons/IcRoundTextFields'
import {IcSharpBrightnessMedium} from 'alinea/ui/icons/IcSharpBrightnessMedium'
import {useAtomValue, useSetAtom} from 'jotai'
import {useMemo} from 'react'
import {dashboardOptionsAtom} from '../../atoms/DashboardAtoms.js'
import {
  preferencesAtom,
  sizePreferenceAtom,
  toggleSchemePreferenceAtom,
  workspacePreferenceAtom
} from '../../atoms/PreferencesAtoms.js'
import {useSession} from '../../hook/UseSession.js'
import {IconButton} from '../IconButton.js'
import {Sidebar} from '../Sidebar.js'
import css from './SidebarSettings.module.scss'

const styles = styler(css)

export function SidebarSettings() {
  const session = useSession()
  const {config} = useAtomValue(dashboardOptionsAtom)
  const preferences = useAtomValue(preferencesAtom)
  const size = preferences.size || 16
  const checked = preferences?.scheme === 'dark'
  const workspaces = Object.entries(config.workspaces)
  const defaultWorkspace = useMemo(
    () =>
      select('Default workspace', {
        options: fromEntries(
          entries(config.workspaces).map(([key, workspace]) => {
            return [key, (Workspace.label(workspace) as string) || key]
          })
        )
      }),
    [config.workspaces]
  )
  const toggleSchemePreference = useSetAtom(toggleSchemePreferenceAtom)
  const updateFontSize = useSetAtom(sizePreferenceAtom)
  const updateWorkspace = useSetAtom(workspacePreferenceAtom)

  function disableTransition(run: () => void) {
    document.body.setAttribute('data-disable-transition', 'true')
    run()
    setTimeout(() => document.body.removeAttribute('data-disable-transition'))
  }

  return (
    <DropdownMenu.Root top style={{margin: 'auto', marginBottom: 0}}>
      <DropdownMenu.Trigger style={{width: '100%'}}>
        <Sidebar.Nav.Item aria-label="Settings">
          <Icon icon={IcBaselineAccountCircle} />
        </Sidebar.Nav.Item>
      </DropdownMenu.Trigger>

      <DropdownMenu.Items style={{maxWidth: px(200)}}>
        <VStack gap={10}>
          {session.user.name && (
            <PopoverMenu.Header>
              <HStack center gap={10} className={styles.root.username()}>
                <Icon icon={IcBaselineAccountCircle} size={26} />
                <Ellipsis>{session.user.name}</Ellipsis>
              </HStack>
            </PopoverMenu.Header>
          )}

          <VStack gap={8}>
            <HStack justify={'space-between'} style={{padding: px(6)}}>
              <HStack center gap={16}>
                <Icon
                  icon={IcSharpBrightnessMedium}
                  size={20}
                  title="Switch theme"
                />
                <Switch
                  checked={checked}
                  onChange={() => {
                    disableTransition(toggleSchemePreference)
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
                  title="Font size"
                />
                <IconButton
                  icon={IcRoundKeyboardArrowDown}
                  onClick={() =>
                    disableTransition(() => updateFontSize(size - 1))
                  }
                  disabled={size <= 16}
                  title="Decrease font size"
                />
                <IconButton
                  icon={IcRoundKeyboardArrowUp}
                  onClick={() =>
                    disableTransition(() => updateFontSize(size + 1))
                  }
                  disabled={size >= 40}
                  title="Increase font size"
                />
              </HStack>
            </HStack>
            {/*workspaces.length > 1 && (
              <InputField
                // Todo: we should use a form here to react to the value change
                value={preferences.workspace || ''}
                onChange={v => updateWorkspace(v ?? undefined)}
                field={defaultWorkspace}
              />
            )*/}
          </VStack>

          {session.end && (
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
