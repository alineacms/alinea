import styler from '@alinea/styler'
import type {PropsWithChildren} from 'react'
import css from './CloudFaq.module.scss'
import {CloudIconMinus, CloudIconPlus} from './CloudIcons'
import {cloudSupportUrl} from './CloudLinks'

const styles = styler(css)

interface CloudFaqItemProps {
  question: string
  open?: boolean
}

function CloudFaqItem({
  question,
  open = false,
  children
}: PropsWithChildren<CloudFaqItemProps>) {
  return (
    <details className={styles.item()} open={open}>
      <summary className={styles.item.question()}>
        {question}
        <span className={styles.item.icon()}>
          <CloudIconPlus className={styles.item.icon.plus()} />
          <CloudIconMinus className={styles.item.icon.minus()} />
        </span>
      </summary>
      <p className={styles.item.answer()}>{children}</p>
    </details>
  )
}

export function CloudFaq() {
  return (
    <section id="faq" className={styles.root()}>
      <div className={styles.root.intro()}>
        <h2 className={styles.root.title()}>Questions, answered</h2>
        <p className={styles.root.text()}>
          Can't find the answer? Reach out to our{' '}
          <a href={cloudSupportUrl} className={styles.root.link()}>
            support inbox
          </a>
          .
        </p>
      </div>
      <div className={styles.root.list()}>
        <CloudFaqItem open question="Do I need Alinea Cloud to use Alinea?">
          No. Alinea only needs a Node.js environment and a git repository. To
          invite other people you need somewhere to manage users, sign-in and
          drafts. You can run that yourself, or let Alinea Cloud handle it.
        </CloudFaqItem>
        {/* TODO: the answers below are not in the design, review the copy */}
        <CloudFaqItem question="Does Alinea Cloud host my website?">
          No. Your website and dashboard stay hosted by you, wherever you deploy
          them today. Alinea Cloud only handles sign-in, drafts and publishing
          to your GitHub repository.
        </CloudFaqItem>
        <CloudFaqItem question="What will Alinea Cloud cost after the beta?">
          [Add pricing after the beta, and how much notice people get.]
        </CloudFaqItem>
        <CloudFaqItem question="What happens to my content if I stop using it?">
          Your published content lives in your own repository, so it stays
          yours. You can switch to running your own backend instead at any time.
        </CloudFaqItem>
      </div>
    </section>
  )
}
