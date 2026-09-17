import styler from '@alinea/styler'
import type {Infer} from 'alinea'
import {RiFlashlightFill} from 'alinea/ui/icons/RiFlashlightFill'
import {
  IcBaselineDashboardCustomize,
  IcRoundFastForward,
  MdiLanguageTypescript,
  MdiSourceBranch,
  ProiconsOpenSource
} from '@/icons'
import {Feature, Features} from '@/layout/Features'
import {WebText} from '@/layout/WebText'
import {WebTypo} from '@/layout/WebTypo'
import type {FeaturesBlock} from '@/schema/blocks/FeaturesBlock'
import css from './FrameworkBlockView.module.scss'

const styles = styler(css)

type FeatureItem = Infer<typeof FeaturesBlock>['items'][number]
function getIcon(iconName: FeatureItem['icon']) {
  switch (iconName) {
    case 'IcBaselineDashboardCustomize':
      return IcBaselineDashboardCustomize
    case 'IcRoundFastForward':
      return IcRoundFastForward
    case 'MdiSourceBranch':
      return MdiSourceBranch
    case 'MdiLanguageTypescript':
      return MdiLanguageTypescript
    case 'ProiconsOpenSource':
      return ProiconsOpenSource
    case 'RiFlashlightFill':
      return RiFlashlightFill
    default:
      return undefined
  }
}

export function FeaturesBlockView({items}: Infer<typeof FeaturesBlock>) {
  if (!items || items.length === 0) return null
  return (
    <section className={styles.root()}>
      <Features>
        {items.map((feature, index) => (
          <Feature key={index}>
            <WebTypo>
              <Feature.Title icon={getIcon(feature.icon)}>
                {feature.title}
              </Feature.Title>
              <WebText doc={feature.description} />
            </WebTypo>
          </Feature>
        ))}
      </Features>
    </section>
  )
}
