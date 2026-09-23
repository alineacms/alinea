import styler from '@alinea/styler'
import type {Infer} from 'alinea'
import type {ReactNode} from 'react'
import type {SectionTypes, sectionsField} from '@/schema/sections/sections'
import {Callout} from './Callout'
import {CardPair} from './CardPair'
import {CodeShowcase} from './CodeShowcase'
import {CompareCards} from './CompareCards'
import {Cta} from './Cta'
import {Faq} from './Faq'
import {FeatureGrid} from './FeatureGrid'
import {FlowCards} from './FlowCards'
import {ProductShot} from './ProductShot'
import css from './Sections.module.scss'
import {Spotlight} from './Spotlight'
import {Steps} from './Steps'
import {Template} from './Template'

const styles = styler(css)

type SectionView<Props> = (props: Props) => ReactNode

type SectionViews = {
  [K in keyof SectionTypes]: SectionView<Infer<SectionTypes[K]>>
}

/** Maps every section `_type` to the component that renders it */
const sectionViews: SectionViews = {
  ProductShot,
  Spotlight,
  CardPair,
  FeatureGrid,
  Steps,
  CodeShowcase,
  CompareCards,
  Template,
  Faq,
  Cta,
  FlowCards,
  Callout
}

export type SectionsData = Infer<ReturnType<typeof sectionsField>>

export interface SectionsProps {
  sections: SectionsData | null | undefined
}

export function Sections({sections}: SectionsProps) {
  if (!sections?.length) return null
  return sections.map(section => {
    const View = sectionViews[section._type] as
      | SectionView<typeof section>
      | undefined
    if (!View) return null
    return (
      <div
        key={section._id}
        id={section.anchor || undefined}
        className={styles.section()}
      >
        <View {...section} />
      </div>
    )
  })
}
