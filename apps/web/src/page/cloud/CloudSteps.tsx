import styler from '@alinea/styler'
import type {PropsWithChildren} from 'react'
import {CloudSection} from './CloudSection'
import css from './CloudSteps.module.scss'

const styles = styler(css)

interface CloudStepProps {
  number: number
  title: string
  description: string
}

function CloudStep({
  number,
  title,
  description,
  children
}: PropsWithChildren<CloudStepProps>) {
  return (
    <li className={styles.step()}>
      <span className={styles.step.number()} aria-hidden="true">
        {number}
      </span>
      <h3 className={styles.step.title()}>{title}</h3>
      <p className={styles.step.description()}>{description}</p>
      {children}
    </li>
  )
}

export function CloudSteps() {
  return (
    <CloudSection
      title="Set up in three steps"
      description="Keep your existing Alinea project. Cloud connects to it through a single key."
    >
      <ol className={styles.root()}>
        <CloudStep
          number={1}
          title="Create a project"
          description="Sign up, connect GitHub and choose the repository your content lives in."
        />
        <CloudStep
          number={2}
          title="Add your API key"
          description="Set one environment variable on your deployment."
        >
          <code className={styles.step.code()}>
            <span className={styles.step.code.key()}>ALINEA_API_KEY</span>
            =alineapk_…
          </code>
        </CloudStep>
        <CloudStep
          number={3}
          title="Invite your editors"
          description="They sign in to your dashboard with their own account and start publishing."
        />
      </ol>
    </CloudSection>
  )
}
