import {
  Avatar,
  DropdownMenu,
  fromModule,
  Icon,
  IconButton,
  TextLabel,
  useColorScheme
} from '@alinea/ui'
import {LogoShape} from '@alinea/ui/branding/LogoShape'
import {IcOutlineScreenshot} from '@alinea/ui/icons/IcOutlineScreenshot'
import {IcRoundKeyboardArrowDown} from '@alinea/ui/icons/IcRoundKeyboardArrowDown'
import {IcRoundMenu} from '@alinea/ui/icons/IcRoundMenu'
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
import {useSidebar} from './Sidebar'
import css from './Toolbar.module.scss'

const styles = fromModule(css)

export namespace Toolbar {
  export const {Provider, Portal, Slot} = createSlots()

  export function Root() {
    const session = useSession()
    const {config} = useDashboard()
    const nav = useNav()
    const [colorScheme, toggleColorScheme] = useColorScheme()
    const {label} = useWorkspace()
    const navigate = useNavigate()
    const {toggleNav, togglePreview} = useSidebar()
    return (
      <HStack center gap={12} className={styles.root()}>
        <div className={styles.root.menu()} onClick={toggleNav}>
          <IconButton icon={IcRoundMenu} />
        </div>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            <HStack center gap={12}>
              <LogoShape>
                <RiFlashlightFill />
              </LogoShape>
              <HStack center gap={4}>
                <div style={{fontSize: '13px'}}>
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
        <div className={styles.root.portal()}>
          <Portal className={styles.root.portal.slot()} />
        </div>
        <div>
          <HStack center gap={8}>
            <IconButton
              icon={IcSharpBrightnessMedium}
              onClick={toggleColorScheme}
            />
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <HStack center gap={4}>
                  <Avatar user={session.user} />
                  <IcRoundKeyboardArrowDown />
                </HStack>
              </DropdownMenu.Trigger>

              <DropdownMenu.Items right>
                <DropdownMenu.Item onClick={session.end}>
                  Logout
                </DropdownMenu.Item>
              </DropdownMenu.Items>
            </DropdownMenu.Root>
            <IconButton icon={IcOutlineScreenshot} onClick={togglePreview} />
          </HStack>
        </div>
      </HStack>
    )
  }
}
