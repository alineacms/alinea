import {
  Avatar,
  DropdownMenu,
  fromModule,
  IconButton,
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
} from 'react-icons/md/index'
import {RiFlashlightFill} from 'react-icons/ri/index'
import {useSession} from '../hook/UseSession'
import css from './Toolbar.module.scss'

const styles = fromModule(css)

export const Toolbar = memo(function Toolbar() {
  const session = useSession()
  const [colorScheme, setColorScheme] = useColorScheme()
  return (
    <HStack center className={styles.root()}>
      <HStack center gap={16}>
        <Logo>
          <RiFlashlightFill />
        </Logo>
        <HStack center gap={4}>
          <div style={{fontSize: '12px'}}>Project</div>
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
          <IconButton
            icon={MdBrightnessMedium}
            onClick={() => {
              setColorScheme(colorScheme === 'dark' ? 'light' : 'dark')
            }}
          />
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              <HStack center gap={4}>
                <Avatar user={session.user} />
                <MdExpandMore />
              </HStack>
            </DropdownMenu.Trigger>

            <DropdownMenu.Content>
              {session.logout && (
                <DropdownMenu.Item onSelect={session.logout}>
                  Logout
                </DropdownMenu.Item>
              )}
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </HStack>
      </div>
    </HStack>
  )
})
