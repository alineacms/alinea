import {
  Avatar,
  DropdownMenu,
  TextLabel,
  fromModule,
  usePreferences
} from '@alinea/ui'

import {HStack} from '@alinea/ui/Stack'
import {IcRoundCheck} from '@alinea/ui/icons/IcRoundCheck'
import IcRoundKeyboardArrowDown from '@alinea/ui/icons/IcRoundKeyboardArrowDown'
import {IcRoundKeyboardArrowRight} from '@alinea/ui/icons/IcRoundKeyboardArrowRight'
import IcRoundTextFields from '@alinea/ui/icons/IcRoundTextFields'
import {IcRoundUnfoldMore} from '@alinea/ui/icons/IcRoundUnfoldMore'
import {IcSharpBrightnessMedium} from '@alinea/ui/icons/IcSharpBrightnessMedium'
import {LogoShape} from '@alinea/ui/branding/LogoShape'
import {RiFlashlightFill} from '@alinea/ui/icons/RiFlashlightFill'
import {contrastColor} from '@alinea/ui/util/ContrastColor'
import {createSlots} from '@alinea/ui/util/Slots'
import css from './Toolbar.module.scss'
import {useDashboard} from '../hook/UseDashboard'
import {useNav} from '../hook/UseNav'
import {useNavigate} from 'react-router'
import {useSession} from '../hook/UseSession'
import {useWorkspace} from '../hook/UseWorkspace'

const styles = fromModule(css)

export namespace Toolbar {
  export const {Provider, Portal, Slot} = createSlots()

  export function Root() {
    const session = useSession()
    const {config} = useDashboard()
    const nav = useNav()
    const [
      preferences,
      toggleColorScheme,
      updateWorkspacePreference,
      updateFontSize
    ] = usePreferences()
    const {label} = useWorkspace()
    const navigate = useNavigate()
    return (
      <HStack center className={styles.root()}>
        <HStack center gap={16}>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              <HStack center gap={16}>
                <LogoShape>
                  <RiFlashlightFill />
                </LogoShape>
                <HStack center gap={4}>
                  <div style={{fontSize: '13px'}}>
                    <TextLabel label={label} />
                  </div>
                  <IcRoundUnfoldMore />
                </HStack>
              </HStack>
            </DropdownMenu.Trigger>

            <DropdownMenu.Content>
              {Object.entries(config.workspaces).map(([key, workspace]) => {
                const root = Object.values(workspace.roots)[0]
                return (
                  <DropdownMenu.Item
                    key={key}
                    onSelect={() =>
                      navigate(
                        nav.entry({
                          workspace: key,
                          root: root.name,
                          locale: root.defaultLocale
                        })
                      )
                    }
                  >
                    <HStack center gap={16}>
                      <LogoShape
                        foreground={contrastColor(workspace.color)}
                        background={workspace.color}
                      >
                        <RiFlashlightFill />
                      </LogoShape>
                      <div>
                        <TextLabel label={workspace.label} />
                      </div>
                    </HStack>
                  </DropdownMenu.Item>
                )
              })}
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </HStack>
        <div className={styles.root.portal()}>
          <Portal className={styles.root.portal.slot()} />
        </div>
        <div>
          <HStack center gap={10}>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <HStack center gap={4}>
                  <Avatar user={session.user} />
                  <IcRoundKeyboardArrowDown />
                </HStack>
              </DropdownMenu.Trigger>

              <DropdownMenu.Content>
                <DropdownMenu.Item onSelect={toggleColorScheme}>
                  <IcSharpBrightnessMedium />
                </DropdownMenu.Item>

                <DropdownMenu.Root>
                  <DropdownMenu.TriggerItem>
                    Default workspace
                    <IcRoundKeyboardArrowRight />
                  </DropdownMenu.TriggerItem>
                  <DropdownMenu.Content>
                    {Object.entries(config.workspaces).map(
                      ([key, workspace]) => {
                        const root = Object.values(workspace.roots)[0]
                        return (
                          <DropdownMenu.Item
                            key={key}
                            onSelect={() => {
                              updateWorkspacePreference(key)
                              // Keep navigation?
                              navigate(
                                nav.entry({
                                  workspace: key,
                                  root: root.name,
                                  locale: root.defaultLocale
                                })
                              )
                            }}
                          >
                            <HStack center gap={16}>
                              <LogoShape
                                foreground={contrastColor(workspace.color)}
                                background={workspace.color}
                              >
                                <RiFlashlightFill />
                              </LogoShape>
                              <div>
                                <TextLabel label={workspace.label} />
                              </div>
                              {key === preferences.workspace && (
                                <IcRoundCheck />
                              )}
                            </HStack>
                          </DropdownMenu.Item>
                        )
                      }
                    )}
                  </DropdownMenu.Content>
                </DropdownMenu.Root>

                <DropdownMenu.Root>
                  <DropdownMenu.TriggerItem>
                    <IcRoundTextFields />
                    <IcRoundKeyboardArrowRight />
                  </DropdownMenu.TriggerItem>
                  <DropdownMenu.Content>
                    <DropdownMenu.Item onSelect={() => updateFontSize('small')}>
                      Small
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      style={{fontSize: '15px'}}
                      onSelect={() => updateFontSize('medium')}
                    >
                      Medium
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      style={{fontSize: '18px'}}
                      onSelect={() => updateFontSize('large')}
                    >
                      Large
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Root>

                <DropdownMenu.Item onSelect={session.end}>
                  Logout
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          </HStack>
        </div>
      </HStack>
    )
  }
}
