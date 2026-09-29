import styler from '@alinea/styler'
import type {Infer} from 'alinea'
import {WebText} from '@/layout/WebText'
import {DocInlineText} from '@/page/docs/DocInlineText'
import {DocsIconInfo, DocsIconWarning} from '@/page/docs/DocsIcons'
import type {NoticeBlock} from '@/schema/blocks/NoticeBlock'
import css from './NoticeView.module.scss'

const styles = styler(css)

export function NoticeView({level, body}: Infer<typeof NoticeBlock>) {
  const isWarning = level === 'warning'
  const Icon = isWarning ? DocsIconWarning : DocsIconInfo
  return (
    <aside className={styles.root({warning: isWarning})}>
      <Icon className={styles.root.icon()} />
      <div className={styles.root.body()}>
        <WebText
          doc={body}
          text={DocInlineText}
          p={<p className={styles.root.text()} />}
        />
      </div>
    </aside>
  )
}
