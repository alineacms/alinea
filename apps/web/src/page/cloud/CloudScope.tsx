import styler from '@alinea/styler'
import {CloudIconCheck} from './CloudIcons'
import css from './CloudScope.module.scss'

const styles = styler(css)

interface CloudScopeListProps {
  title: string
  items: Array<string>
  dashed?: boolean
}

function CloudScopeList({title, items, dashed = false}: CloudScopeListProps) {
  return (
    <div className={styles.panel({dashed})}>
      <h2 className={styles.panel.title()}>{title}</h2>
      <ul className={styles.panel.list()}>
        {items.map(item => (
          <li key={item} className={styles.panel.item()}>
            <span className={styles.panel.check()}>
              <CloudIconCheck />
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function CloudScope() {
  return (
    <section className={styles.root()}>
      <CloudScopeList
        title="What Cloud takes care of"
        items={[
          'Sign-in for everyone who edits content',
          'Drafts, kept out of your repository until published',
          'Teams, invites and roles',
          'A push to your GitHub repository on every publish'
        ]}
      />
      <CloudScopeList
        dashed
        title="What stays yours"
        items={[
          'Your content, in your own repository',
          'Your website and dashboard, hosted by you',
          'Your schema and code',
          'The option to run your own backend instead'
        ]}
      />
    </section>
  )
}
