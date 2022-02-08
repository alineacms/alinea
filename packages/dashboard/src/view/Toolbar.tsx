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
import {memo} from 'react'
import {
  MdBrightnessMedium,
  MdExpandMore,
  MdFormatBold,
  MdFormatItalic,
  MdFormatQuote,
  MdFormatUnderlined,
  MdInsertLink,
  MdInsertPhoto,
  MdUnfoldMore
} from 'react-icons/md'
import {RiFlashlightFill} from 'react-icons/ri'
import {useSession} from '../hook/UseSession'
import {useWorkspace} from '../hook/UseWorkspace'
import css from './Toolbar.module.scss'

const styles = fromModule(css)

export const Toolbar = memo(function Toolbar() {
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
      <div style={{margin: 'auto', fontSize: '20px'}}>
        <HStack center gap={20}>
          <MdFormatBold />
          <MdFormatItalic />
          <MdFormatUnderlined />
          <MdFormatQuote />
          <MdInsertLink />
          <MdInsertPhoto />
        </HStack>
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
})
