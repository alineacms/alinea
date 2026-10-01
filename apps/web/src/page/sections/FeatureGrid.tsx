import styler from '@alinea/styler'
import type {Infer} from 'alinea'
import Link from 'next/link'
import {Image} from '@/layout/Image'
import {Label} from '@/layout/Label'
import {Section} from '@/layout/Section'
import {SectionHeader} from '@/layout/SectionHeader'
import type {FeatureGrid as FeatureGridSchema} from '@/schema/sections/FeatureGrid'
import {ArrowLink} from './ArrowLink'
import {Band} from './Band'
import css from './FeatureGrid.module.scss'
import {resolveLink} from './links'
import {SectionIcon} from './SectionIcon'

const styles = styler(css)

export interface FeatureGridProps extends Infer<typeof FeatureGridSchema> {}

type FeatureItemData = FeatureGridProps['items'][number]

interface FeatureItemProps {
  item: FeatureItemData
}

function FeatureItem({item}: FeatureItemProps) {
  const link = resolveLink(item.link)
  // Only show a label set on the item, not the title of a linked entry
  const label = item.link?.fields?.label
  const content = (
    <>
      {(item.icon || item.tag) && (
        <div className={styles.item.top()}>
          {item.icon && (
            <SectionIcon name={item.icon} className={styles.item.icon()} />
          )}
          {item.tag && (
            <Label className={styles.item.tag()}>{item.tag}</Label>
          )}
        </div>
      )}
      {item.title && (
        <h3 className={styles.item.title()}>
          {item.title}
          {link && !label && (
            <span aria-hidden="true" className={styles.item.arrow()}>
              →
            </span>
          )}
        </h3>
      )}
      {item.text && <p className={styles.item.text()}>{item.text}</p>}
      {link && label && (
        <span className={styles.item.more()}>
          {label}
          <span aria-hidden="true" className={styles.item.arrow()}>
            →
          </span>
        </span>
      )}
    </>
  )
  if (!link) return <article className={styles.item()}>{content}</article>
  return (
    <Link
      href={link.href}
      target={link.target}
      className={styles.item({link: true})}
    >
      {content}
    </Link>
  )
}

// Small screens crop the top left of the screenshot, see the module styles
const bannerStyle = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  objectPosition: 'left top'
} as const

export function FeatureGrid({
  title,
  label,
  description,
  link,
  panel,
  image,
  darkImage,
  items
}: FeatureGridProps) {
  const action = resolveLink(link)
  const hasImage = Boolean(image?.src)
  const hasDarkImage = Boolean(darkImage?.src)
  const Container = panel ? Band : Section
  return (
    <Container>
      <div className={styles.root()}>
        {(title || action) && (
          <div className={styles.root.header()}>
            <SectionHeader
              title={title}
              label={label || undefined}
              description={description || undefined}
              className={styles.root.heading()}
            />
            <ArrowLink link={action} className={styles.root.action()} />
          </div>
        )}
        {hasImage && (
          <div className={styles.root.banner()}>
            <Image
              {...image}
              unoptimized
              style={bannerStyle}
              className={styles.root.banner.image({light: hasDarkImage})}
            />
            {hasDarkImage && (
              <Image
                {...darkImage}
                unoptimized
                style={bannerStyle}
                className={styles.root.banner.image('dark')}
              />
            )}
          </div>
        )}
        {items?.length > 0 && (
          <div className={styles.root.grid()}>
            {items.map(item => (
              <FeatureItem key={item._id} item={item} />
            ))}
          </div>
        )}
      </div>
    </Container>
  )
}
