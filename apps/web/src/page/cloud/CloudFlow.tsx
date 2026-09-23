import styler from '@alinea/styler'
import type {ReactNode} from 'react'
import css from './CloudFlow.module.scss'
import {
  CloudIconBranch,
  CloudIconGlobe,
  CloudIconLock,
  CloudIconUsers
} from './CloudIcons'

const styles = styler(css)

interface CloudFlowCardProps {
  icon: ReactNode
  title: string
  description: string
  highlight?: boolean
}

function CloudFlowCard({
  icon,
  title,
  description,
  highlight = false
}: CloudFlowCardProps) {
  return (
    <div className={styles.card({highlight})}>
      <span className={styles.card.icon()}>{icon}</span>
      <h3 className={styles.card.title()}>{title}</h3>
      <p className={styles.card.description()}>{description}</p>
    </div>
  )
}

export function CloudFlow() {
  return (
    <section
      id="how-it-works"
      className={styles.root()}
      aria-label="How Alinea Cloud fits in"
    >
      <CloudFlowCard
        icon={<CloudIconUsers />}
        title="Your editors"
        description="Sign in to your dashboard with their Alinea Cloud account"
      />
      <CloudFlowCard
        highlight
        icon={<CloudIconLock />}
        title="Alinea Cloud"
        description="Checks who they are and what they may do, and keeps their drafts"
      />
      <CloudFlowCard
        icon={<CloudIconBranch />}
        title="Your GitHub repo"
        description="Publishing commits the content to your branch as JSON"
      />
      <CloudFlowCard
        icon={<CloudIconGlobe />}
        title="Your site"
        description="Picks up the new content, wherever you host it"
      />
    </section>
  )
}
