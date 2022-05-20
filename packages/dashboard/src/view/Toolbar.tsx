import {InputState} from '@alinea/editor/InputState'
import {select} from '@alinea/input.select'
import {SelectInput} from '@alinea/input.select/view'
import {
  Avatar,
  DropdownMenu,
  fromModule,
  Icon,
  px,
  TextLabel,
  usePreferences,
  VStack
} from '@alinea/ui'
import {LogoShape} from '@alinea/ui/branding/LogoShape'
import IcRoundKeyboardArrowDown from '@alinea/ui/icons/IcRoundKeyboardArrowDown'
import IcRoundTextFields from '@alinea/ui/icons/IcRoundTextFields'
import {IcRoundUnfoldMore} from '@alinea/ui/icons/IcRoundUnfoldMore'
import {IcSharpBrightnessMedium} from '@alinea/ui/icons/IcSharpBrightnessMedium'
import {RiFlashlightFill} from '@alinea/ui/icons/RiFlashlightFill'
import {PopoverMenu} from '@alinea/ui/PopoverMenu'
import {HStack} from '@alinea/ui/Stack'
import {contrastColor} from '@alinea/ui/util/ContrastColor'
import {createSlots} from '@alinea/ui/util/Slots'
import {Switch} from '@headlessui/react'
import {useState} from 'react'
import {useNavigate} from 'react-router'
import {useDashboard} from '../hook/UseDashboard'
import {useNav} from '../hook/UseNav'
import {useSession} from '../hook/UseSession'
import {useWorkspace} from '../hook/UseWorkspace'
import css from './Toolbar.module.scss'

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
    const [workspace = preferences?.workspace, setWorkspace] = useState<
      string | undefined
    >()
    const checked = preferences?.scheme === 'dark'
    return (
      <HStack center className={styles.root()}>
        <HStack gap={16}>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              <HStack center gap={16}>
                <LogoShape>
                  <RiFlashlightFill />
                </LogoShape>
                <HStack center gap={4}>
                  <div style={{fontSize: px(13)}}>
                    <TextLabel label={label} />
                  </div>
                  <Icon icon={IcRoundUnfoldMore} />
                </HStack>
              </HStack>
            </DropdownMenu.Trigger>

            <DropdownMenu.Items>
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
                    <HStack center gap={16} full>
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
            </DropdownMenu.Items>
          </DropdownMenu.Root>
        </HStack>
        <div className={styles.root.portal()}>
          <Portal className={styles.root.portal.slot()} />
        </div>
        <div>
          <HStack center gap={10}>
            <PopoverMenu.Root>
              <PopoverMenu.Trigger>
                <HStack center gap={4}>
                  <Avatar user={session.user} />
                  <Icon icon={IcRoundKeyboardArrowDown} />
                  {/* <IcRoundKeyboardArrowDown /> */}
                </HStack>
              </PopoverMenu.Trigger>

              <PopoverMenu.Items right>
                <VStack>
                  <HStack center gap={8}>
                    <Icon icon={IcSharpBrightnessMedium} size={20} />
                    <Switch
                      checked={checked}
                      onChange={toggleColorScheme}
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
                  <HStack center gap={8}>
                    <Icon icon={IcRoundTextFields} size={20} />
                    <input
                      className={styles.root.range()}
                      type="range"
                      min={16}
                      max={41}
                      step={5}
                      value={preferences.size || 16}
                      onChange={e =>
                        updateFontSize(Number(e.currentTarget.value))
                      }
                    ></input>
                  </HStack>
                  {/* <SelectInput
                    state={new InputState.StatePair(workspace, setWorkspace)}
                    field={select(
                      'Default workspace',
                      Object.entries(config.workspaces).map(
                        ([key, workspace]) => {
                          // const root = Object.values(workspace.roots)[0]
                          return key
                        }
                    )}
                  /> */}
                  <DropdownMenu.Root>
                    <DropdownMenu.Item onSelect={session.end}>
                      Logout
                    </DropdownMenu.Item>
                  </DropdownMenu.Root>
                </VStack>
              </PopoverMenu.Items>
            </PopoverMenu.Root>
            {/* <DropdownMenu.Root>
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
              </DropdownMenu.Items>
            </DropdownMenu.Root> */}
          </HStack>
        </div>
      </HStack>
    )
  }
}
