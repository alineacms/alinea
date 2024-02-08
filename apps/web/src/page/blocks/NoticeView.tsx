import {IcOutlineInfo} from '@/icons'
import {WebText} from '@/layout/WebText'
import {NoticeBlock} from '@/schema/blocks/NoticeBlock'
import alinea from 'alinea'
import {fromModule, HStack} from 'alinea/ui'
import css from './NoticeView.module.scss'

const styles = fromModule(css)

export function NoticeView({level, body}: alinea.infer<typeof NoticeBlock>) {
  return (
    <div className={styles.root(level)}>
      <HStack gap={10}>
        <IcOutlineInfo className={styles.root.icon()} />
        <WebText doc={body} />
      </HStack>
    </div>
  )
}
