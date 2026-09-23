import styler from '@alinea/styler'
import type {ReactNode} from 'react'
import css from './CloudFeatures.module.scss'
import {
  CloudIconBranch,
  CloudIconFile,
  CloudIconHistory,
  CloudIconLock,
  CloudIconMail,
  CloudIconUsers
} from './CloudIcons'
import {CloudSection} from './CloudSection'

const styles = styler(css)

interface CloudFeatureProps {
  icon: ReactNode
  title: string
  description: string
}

function CloudFeature({icon, title, description}: CloudFeatureProps) {
  return (
    <div className={styles.feature()}>
      <span className={styles.feature.icon()}>{icon}</span>
      <h3 className={styles.feature.title()}>{title}</h3>
      <p className={styles.feature.description()}>{description}</p>
    </div>
  )
}

export function CloudFeatures() {
  return (
    <CloudSection
      id="features"
      title="Everything you need to go live"
      description="Modern CMS features with as little configuration as possible."
    >
      <div className={styles.root()}>
        <CloudFeature
          icon={<CloudIconLock />}
          title="Authentication"
          description="Editors sign in through Alinea Cloud to reach your dashboard. No login system to build."
        />
        <CloudFeature
          icon={<CloudIconFile />}
          title="Drafts"
          description="Unpublished drafts are stored in Cloud, so they don't clutter your repository."
        />
        <CloudFeature
          icon={<CloudIconBranch />}
          title="Publishing"
          description="Publishing in Alinea pushes the changes to your GitHub repository."
        />
        <CloudFeature
          icon={<CloudIconUsers />}
          title="Teams"
          description="Group projects in teams to manage who has access to what."
        />
        <CloudFeature
          icon={<CloudIconMail />}
          title="Invites"
          description="Invite people from the dashboard and assign them a role."
        />
        <CloudFeature
          icon={<CloudIconHistory />}
          title="History"
          description="Review recent content changes in your projects."
        />
      </div>
    </CloudSection>
  )
}
