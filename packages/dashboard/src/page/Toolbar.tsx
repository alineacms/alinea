import {Logo} from '@alinea/ui/branding/Logo'
import {HStack} from '@alinea/ui/Stack'
import {fromModule} from '@alinea/ui/styler'
import {
  MdFormatBold,
  MdFormatItalic,
  MdFormatQuote,
  MdFormatUnderlined,
  MdInsertLink,
  MdInsertPhoto,
  MdUnfoldMore
} from 'react-icons/md'
import {RiFlashlightFill} from 'react-icons/ri'
import css from './Toolbar.module.scss'

const styles = fromModule(css)

export function Toolbar() {
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
    </HStack>
  )
}
