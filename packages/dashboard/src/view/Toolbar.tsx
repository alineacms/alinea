import {InputState} from '@alinea/editor/InputState'
import {select} from '@alinea/input.select'
import {SelectInput} from '@alinea/input.select/view'
import {
  Avatar,
  DropdownMenu,
  fromModule,
  Icon,
  IconButton,
  px,
  TextLabel,
  usePreferences,
  VStack
} from '@alinea/ui'
import {LogoShape} from '@alinea/ui/branding/LogoShape'
import IcRoundKeyboardArrowDown from '@alinea/ui/icons/IcRoundKeyboardArrowDown'
import IcRoundKeyboardArrowUp from '@alinea/ui/icons/IcRoundKeyboardArrowUp'
import IcRoundTextFields from '@alinea/ui/icons/IcRoundTextFields'
import {IcRoundUnfoldMore} from '@alinea/ui/icons/IcRoundUnfoldMore'
import {IcSharpBrightnessMedium} from '@alinea/ui/icons/IcSharpBrightnessMedium'
import {RiFlashlightFill} from '@alinea/ui/icons/RiFlashlightFill'
import {PopoverMenu} from '@alinea/ui/PopoverMenu'
import {HStack} from '@alinea/ui/Stack'
import {contrastColor} from '@alinea/ui/util/ContrastColor'
import {createSlots} from '@alinea/ui/util/Slots'
import {Switch} from '@headlessui/react'
import {parseToHsla} from 'color2k'
import {useNavigate} from 'react-router'
import {useDashboard} from '../hook/UseDashboard'
import {useNav} from '../hook/UseNav'
import {useSession} from '../hook/UseSession'
import {useWorkspace} from '../hook/UseWorkspace'
import css from './Toolbar.module.scss'

const styles = fromModule(css)

type ToolbarProps = {
  color: string
}

export namespace Toolbar {
  export const {Provider, Portal, Slot} = createSlots()

  export function Root({color}: ToolbarProps) {
    const accentColor = color!
    const session = useSession()
    const {config} = useDashboard()
    const nav = useNav()
    const preferences = usePreferences()
    const {label} = useWorkspace()
    const navigate = useNavigate()
    const size = preferences.size || 16
    const checked = preferences?.scheme === 'dark'
    const [hue, saturation, lightness] = parseToHsla(accentColor)
    const style: any = {
      '--alinea-hue': hue,
      '--alinea-saturation': `${saturation * 100}%`,
      '--alinea-lightness': `${lightness * 100}%`
    }
    const className = styles.root()
    const toolbarProps = {className, style}
    return (
      <HStack
        {...toolbarProps}
        center
        className={styles.root.mergeProps(toolbarProps)()}
      >
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
                  <IcRoundKeyboardArrowDown />
                </HStack>
              </PopoverMenu.Trigger>

              <PopoverMenu.Items right>
                <VStack gap={25}>
                  <PopoverMenu.Header>
                    <p>
                      {session.user.sub.charAt(0).toUpperCase() +
                        session.user.sub.slice(1)}
                    </p>
                  </PopoverMenu.Header>

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
                    <SelectInput
                      state={
                        new InputState.StatePair(
                          preferences.workspace || '',
                          preferences.setWorkspace
                        )
                      }
                      field={select(
                        'Default workspace',
                        Object.fromEntries(
                          Object.entries(config.workspaces).map(
                            ([key, workspace]) => {
                              return [key, workspace.label || key]
                            }
                          )
                        )
                      )}
                    />
                    {/* <SelectInput
                    state={
                      new InputState.StatePair(preferences.language || '', setLanguage)
                    }
                    field={select<string>('Default language', {en: 'EN'})}
                  /> */}
                  </VStack>

                  <PopoverMenu.Footer>
                    <DropdownMenu.Root>
                      <DropdownMenu.Item onSelect={session.end}>
                        Logout
                      </DropdownMenu.Item>
                    </DropdownMenu.Root>
                  </PopoverMenu.Footer>
                </VStack>
              </PopoverMenu.Items>
            </PopoverMenu.Root>
          </HStack>
        </div>
      </HStack>
    )
  }
}
