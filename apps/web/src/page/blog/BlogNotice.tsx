import styler from '@alinea/styler'
import type {Infer} from 'alinea'
import {RichText} from 'alinea/ui/RichText'
import type {NoticeBlock} from '@/schema/blocks/NoticeBlock'
import {BlogIconInfo, BlogIconWarning} from './BlogIcons'
import css from './BlogNotice.module.scss'

const styles = styler(css)

export function BlogNotice({level, body}: Infer<typeof NoticeBlock>) {
  const Icon = level === 'warning' ? BlogIconWarning : BlogIconInfo
  return (
    <div className={styles.root({warning: level === 'warning'})}>
      <Icon className={styles.root.icon()} />
      <div className={styles.root.body()}>
        <RichText
          doc={body}
          p={<p className={styles.root.paragraph()} />}
          a={<a className={styles.root.link()} />}
        />
      </div>
    </div>
  )
}
