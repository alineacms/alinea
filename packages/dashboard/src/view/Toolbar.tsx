import {
  Avatar,
  DropdownMenu,
  fromModule,
  IconButton,
  TextLabel,
  useColorScheme
} from '@alineacms/ui'
import {LogoShape} from '@alineacms/ui/branding/LogoShape'
import {HStack} from '@alineacms/ui/Stack'
import {contrastColor} from '@alineacms/ui/util/ContrastColor'
import {createSlots} from '@alineacms/ui/util/Slots'
import {MdBrightnessMedium, MdExpandMore, MdUnfoldMore} from 'react-icons/md'
import {RiFlashlightFill} from 'react-icons/ri'
import {useHistory} from 'react-router'
import {useDashboard} from '../hook/UseDashboard'
import {useSession} from '../hook/UseSession'
import {useWorkspace} from '../hook/UseWorkspace'
import css from './Toolbar.module.scss'

const styles = fromModule(css)

export namespace Toolbar {
  export const {Provider, Portal, Slot} = createSlots()

  export function Root() {
    const session = useSession()
    const {config, nav} = useDashboard()
    const [colorScheme, toggleColorScheme] = useColorScheme()
    const {name} = useWorkspace()
    const history = useHistory()
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
                    <TextLabel label={name} />
                  </div>
                  <MdUnfoldMore />
                </HStack>
              </HStack>
            </DropdownMenu.Trigger>

            <DropdownMenu.Content>
              {Object.entries(config.workspaces).map(([key, workspace]) => {
                const firstRoot = Object.keys(workspace.roots)[0]
                return (
                  <DropdownMenu.Item
                    key={key}
                    onClick={() => history.push(nav.entry(key, firstRoot))}
                  >
                    <HStack center gap={16}>
                      <LogoShape
                        foreground={contrastColor(workspace.color)}
                        background={workspace.color}
                      >
                        <RiFlashlightFill />
                      </LogoShape>
                      <div>
                        <TextLabel label={workspace.name} />
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
            <IconButton icon={MdBrightnessMedium} onClick={toggleColorScheme} />
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <HStack center gap={4}>
                  <Avatar user={session.user} />
                  <MdExpandMore />
                </HStack>
              </DropdownMenu.Trigger>

              <DropdownMenu.Content>
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
