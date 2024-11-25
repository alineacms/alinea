import styler from '@alinea/styler'
import {Workspace} from 'alinea/core/Workspace'
import {entries, fromEntries} from 'alinea/core/util/Objects'
import {select} from 'alinea/field'
import {HStack, Icon, VStack, px} from 'alinea/ui'
import {Ellipsis} from 'alinea/ui/Ellipsis'
import {IcBaselineAccountCircle} from 'alinea/ui/icons/IcBaselineAccountCircle'
import {IcRoundKeyboardArrowDown} from 'alinea/ui/icons/IcRoundKeyboardArrowDown'
import {IcRoundKeyboardArrowUp} from 'alinea/ui/icons/IcRoundKeyboardArrowUp'
import {IcRoundTextFields} from 'alinea/ui/icons/IcRoundTextFields'
import {IcSharpBrightnessMedium} from 'alinea/ui/icons/IcSharpBrightnessMedium'
import {useAtomValue, useSetAtom} from 'jotai'
import {useMemo} from 'react'
import {
  Button,
  Dialog,
  DialogTrigger,
  Popover,
  Switch
} from 'react-aria-components'
import {dashboardOptionsAtom} from '../../atoms/DashboardAtoms.js'
import {
  preferencesAtom,
  sizePreferenceAtom,
  toggleSchemePreferenceAtom
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

  function disableTransition(run: () => void) {
    document.body.setAttribute('data-disable-transition', 'true')
    run()
    setTimeout(() => document.body.removeAttribute('data-disable-transition'))
  }

  return (
    <DialogTrigger>
      <Sidebar.Nav.Item
        as={Button}
        aria-label="Settings"
        style={{marginTop: 'auto'}}
      >
        <Icon icon={IcBaselineAccountCircle} />
      </Sidebar.Nav.Item>

      <Popover placement="top left" style={{maxWidth: px(200)}}>
        <Dialog className={styles.root.popover()}>
          <VStack gap={10}>
            {session.user.name && (
              <header className={styles.root.header()}>
                <HStack center gap={10} className={styles.root.username()}>
                  <Icon icon={IcBaselineAccountCircle} size={26} />
                  <Ellipsis>{session.user.name}</Ellipsis>
                </HStack>
              </header>
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
                    isSelected={checked}
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
              <footer className={styles.root.footer()}>
                <Button onPress={session.end}>Logout</Button>
              </footer>
            )}
          </VStack>
        </Dialog>
      </Popover>
    </DialogTrigger>
  )
}
