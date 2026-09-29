import {Field} from 'alinea'
import {Callout} from './Callout'
import {CardPair} from './CardPair'
import {CodeShowcase} from './CodeShowcase'
import {CompareCards} from './CompareCards'
import {Cta} from './Cta'
import {Faq} from './Faq'
import {FeatureGrid} from './FeatureGrid'
import {FlowCards} from './FlowCards'
import {ProductShot} from './ProductShot'
import {Spotlight} from './Spotlight'
import {Steps} from './Steps'
import {Template} from './Template'

/** Every section type, keyed by the `_type` stored in content */
export const sectionTypes = {
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

export type SectionTypes = typeof sectionTypes

export function sectionsField(label = 'Sections') {
  return Field.list(label, {schema: sectionTypes})
}
