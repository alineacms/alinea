import {IcOutlineInfo} from '@/icons'
import {WebText} from '@/layout/WebText'
import {NoticeBlock} from '@/schema/blocks/NoticeBlock'
import styler from '@alinea/styler'
import {Infer} from 'alinea'
import {HStack} from 'alinea/ui'
import css from './NoticeView.module.scss'

const styles = styler(css)

export function NoticeView({level, body}: Infer<typeof NoticeBlock>) {
  return (
    <div className={styles.root(level)}>
      <HStack gap={10}>
        <IcOutlineInfo className={styles.root.icon()} />
        <WebText doc={body} />
      </HStack>
    </div>
  )
}
