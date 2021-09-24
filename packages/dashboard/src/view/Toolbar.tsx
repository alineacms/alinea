import {Logo} from '@alinea/ui/branding/Logo'
import {HStack} from '@alinea/ui/Stack'
import {fromModule} from '@alinea/ui/styler'
import {memo} from 'react'
import {
  MdBrightnessMedium,
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

export const Toolbar = memo(function Toolbar() {
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
        <HStack center gap={20}>
          <MdBrightnessMedium />
          <div
            style={{
              borderRadius: '100%',
              background: '#FF8577',
              color: 'white',
              width: '24px',
              height: '24px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              fontSize: '13px'
            }}
          >
            <span>B</span>
          </div>
        </HStack>
      </div>
    </HStack>
  )
})
