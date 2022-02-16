import {
  Avatar,
  DropdownMenu,
  fromModule,
  IconButton,
  TextLabel,
  useColorScheme
} from '@alinea/ui'
import {Logo} from '@alinea/ui/branding/Logo'
import {HStack} from '@alinea/ui/Stack'
import {createSlots} from '@alinea/ui/util/Slots'
import {MdBrightnessMedium, MdExpandMore, MdUnfoldMore} from 'react-icons/md'
import {RiFlashlightFill} from 'react-icons/ri'
import {useSession} from '../hook/UseSession'
import {useWorkspace} from '../hook/UseWorkspace'
import css from './Toolbar.module.scss'

const styles = fromModule(css)

export namespace Toolbar {
  export const {Provider, Portal, Slot} = createSlots()

  export function Root() {
    const session = useSession()
    const [colorScheme, toggleColorScheme] = useColorScheme()
    const {name} = useWorkspace()
    return (
      <HStack center className={styles.root()}>
        <HStack center gap={16}>
          <Logo>
            <RiFlashlightFill />
          </Logo>
          <HStack center gap={4}>
            <div style={{fontSize: '12px'}}>
              <TextLabel label={name} />
            </div>
            <MdUnfoldMore />
          </HStack>
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
