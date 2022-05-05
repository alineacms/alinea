import {
  Avatar,
  DropdownMenu,
  fromModule,
  IconButton,
  TextLabel,
  useColorScheme
} from '@alinea/ui'
import {LogoShape} from '@alinea/ui/branding/LogoShape'
import CodiconOpenPreview from '@alinea/ui/icons/CodiconOpenPreview'
import {IcRoundKeyboardArrowDown} from '@alinea/ui/icons/IcRoundKeyboardArrowDown'
import IcRoundSegment from '@alinea/ui/icons/IcRoundSegment'
import {IcRoundUnfoldMore} from '@alinea/ui/icons/IcRoundUnfoldMore'
import {IcSharpBrightnessMedium} from '@alinea/ui/icons/IcSharpBrightnessMedium'
import {RiFlashlightFill} from '@alinea/ui/icons/RiFlashlightFill'
import {HStack} from '@alinea/ui/Stack'
import {contrastColor} from '@alinea/ui/util/ContrastColor'
import {createSlots} from '@alinea/ui/util/Slots'
import {useNavigate} from 'react-router'
import {useDashboard} from '../hook/UseDashboard'
import {useNav} from '../hook/UseNav'
import {usePaneIndex} from '../hook/UsePaneIndex'
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
    const [colorScheme, toggleColorScheme] = useColorScheme()
    const {label} = useWorkspace()
    const navigate = useNavigate()
    const paneIndex = usePaneIndex()
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
        <div className={styles.root.panes()}>
          <IconButton
            icon={IcRoundSegment}
            onClick={() => {
              if (!paneIndex) return
              if (paneIndex.index === 0) {
                paneIndex.setIndex(1)
                return
              }
              paneIndex.setIndex(0)
            }}
            active={paneIndex?.index === 0}
          />
        </div>
        <div className={styles.root.portal()}>
          <Portal className={styles.root.portal.slot()} />
        </div>
        <div className={styles.root.panes({preview: true})}>
          <IconButton
            icon={CodiconOpenPreview}
            onClick={() => {
              if (!paneIndex) return
              if (paneIndex.index === 2) {
                paneIndex.setIndex(1)
                return
              }
              paneIndex.setIndex(2)
            }}
            active={paneIndex?.index === 2}
          />
        </div>
        <div>
          <HStack center gap={10}>
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
