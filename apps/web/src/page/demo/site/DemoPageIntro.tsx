import styler from '@alinea/styler'
import type {ReactNode} from 'react'
import {DemoContainer} from './DemoContainer'
import css from './DemoPageIntro.module.scss'

const styles = styler(css)

export interface DemoPageIntroProps {
  eyebrow?: ReactNode
  title: ReactNode
  intro?: ReactNode
}

/** The title and intro at the top of overview pages */
export function DemoPageIntro({eyebrow, title, intro}: DemoPageIntroProps) {
  return (
    <DemoContainer className={styles.DemoPageIntro()}>
      {eyebrow && <p className={styles.DemoPageIntro.eyebrow()}>{eyebrow}</p>}
      <h1 className={styles.DemoPageIntro.title()}>{title}</h1>
      {intro && <p className={styles.DemoPageIntro.intro()}>{intro}</p>}
    </DemoContainer>
  )
}
