import {
  Avatar,
  DropdownMenu,
  fromModule,
  IconButton,
  TextLabel,
  usePreferences
} from '@alinea/ui'
import {LogoShape} from '@alinea/ui/branding/LogoShape'
import {IcRoundKeyboardArrowDown} from '@alinea/ui/icons/IcRoundKeyboardArrowDown'
import IcRoundTextFields from '@alinea/ui/icons/IcRoundTextFields'
import {IcRoundUnfoldMore} from '@alinea/ui/icons/IcRoundUnfoldMore'
import {IcSharpBrightnessMedium} from '@alinea/ui/icons/IcSharpBrightnessMedium'
import {RiFlashlightFill} from '@alinea/ui/icons/RiFlashlightFill'
import {HStack} from '@alinea/ui/Stack'
import {contrastColor} from '@alinea/ui/util/ContrastColor'
import {createSlots} from '@alinea/ui/util/Slots'
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
    const [preferences, toggleColorScheme] = usePreferences()
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
            {/* <IconButton
              icon={IcSharpBrightnessMedium}
              onClick={toggleColorScheme}
            /> */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <HStack center gap={4}>
                  <Avatar user={session.user} />
                  <IcRoundKeyboardArrowDown />
                </HStack>
              </DropdownMenu.Trigger>

              <DropdownMenu.Content>
                <IconButton
                  icon={IcSharpBrightnessMedium}
                  onClick={toggleColorScheme}
                />
                <DropdownMenu.Root>
                  <DropdownMenu.TriggerItem>
                    <DropdownMenu.Label>
                      <IcRoundTextFields /> Font size
                    </DropdownMenu.Label>
                  </DropdownMenu.TriggerItem>
                  <DropdownMenu.Content>
                    {/* <DropdownMenu.Item onSelect={toggleFontSize}>
                      Small
                    </DropdownMenu.Item> */}
                    {/* <DropdownMenu.Item onClick={() => setFontSize('medium')}>
                      Medium
                    </DropdownMenu.Item>
                    <DropdownMenu.Item onClick={() => setFontSize('large')}>
                      Large
                    </DropdownMenu.Item> */}
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
                <DropdownMenu.Separator />
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
