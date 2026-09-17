import styler from '@alinea/styler'
import type {Infer} from 'alinea'
import {IcRoundInsertDriveFile} from 'alinea/ui/icons/IcRoundInsertDriveFile'
import {IcRoundPublish} from 'alinea/ui/icons/IcRoundPublish'
import {PhGlobe} from 'alinea/ui/icons/PhGlobe'
import {RiFlashlightFill} from 'alinea/ui/icons/RiFlashlightFill'
import {HStack} from 'alinea/ui/Stack'
import {px} from 'alinea/ui/util/Units'
import type {ComponentType} from 'react'
import {
  IcBaselineCloudQueue,
  IcBaselineDashboardCustomize,
  IcBaselineWorkspaces,
  IcRoundFastForward,
  MdiLanguageTypescript,
  MdiSourceBranch,
  ProiconsOpenSource
} from '@/icons'
import {Link} from '@/layout/nav/Link'
import type {QuickLinksBlock} from '@/schema/blocks/QuickLinksBlock'
import css from './QuickLinksBlockView.module.scss'

const styles = styler(css)

type QuickLink = Infer<typeof QuickLinksBlock>['items'][number]

function getIcon(iconName: QuickLink['icon']) {
  switch (iconName) {
    case 'IcBaselineCloudQueue':
      return IcBaselineCloudQueue
    case 'IcBaselineDashboardCustomize':
      return IcBaselineDashboardCustomize
    case 'IcBaselineWorkspaces':
      return IcBaselineWorkspaces
    case 'IcRoundFastForward':
      return IcRoundFastForward
    case 'IcRoundInsertDriveFile':
      return IcRoundInsertDriveFile
    case 'IcRoundPublish':
      return IcRoundPublish
    case 'MdiSourceBranch':
      return MdiSourceBranch
    case 'MdiLanguageTypescript':
      return MdiLanguageTypescript
    case 'PhGlobe':
      return PhGlobe
    case 'ProiconsOpenSource':
      return ProiconsOpenSource
    case 'RiFlashlightFill':
      return RiFlashlightFill
    default:
      return undefined
  }
}

export function QuickLinksBlockView({items}: Infer<typeof QuickLinksBlock>) {
  if (!items || items.length === 0) return null
  return (
    <section className={styles.root()}>
      <HStack justify="space-evenly" gap={`${px(16)} ${px(30)}`} wrap>
        {items.map(
          (item, index) =>
            item?.link?.href && (
              <Item
                icon={item?.icon ? getIcon(item.icon) : RiFlashlightFill}
                link={item.link}
                key={index}
              />
            )
        )}
      </HStack>
    </section>
  )
}

function Item({
  icon: Icon,
  link
}: {
  icon?: ComponentType
  link: QuickLink['link']
}) {
  return (
    <Link href={link?.href} className={styles.item()}>
      <HStack gap={10}>
        {Icon && <Icon />}
        <span style={{lineHeight: 1}}>{link?.fields?.label || link.title}</span>
      </HStack>
    </Link>
  )
}
