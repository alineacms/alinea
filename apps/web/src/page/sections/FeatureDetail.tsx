import styler from '@alinea/styler'
import type {Infer} from 'alinea'
import {RichText} from 'alinea/ui/RichText'
import {Image} from '@/layout/Image'
import {Label} from '@/layout/Label'
import {Section} from '@/layout/Section'
import type {FeatureDetail as FeatureDetailSchema} from '@/schema/sections/FeatureDetail'
import {ArrowLink} from './ArrowLink'
import css from './FeatureDetail.module.scss'
import {resolveLink} from './links'
import {SectionIcon} from './SectionIcon'

const styles = styler(css)

export interface FeatureDetailProps extends Infer<typeof FeatureDetailSchema> {}

// Screenshots are captured at twice their layout width and served as is,
// the image optimizer would blur the interface text
const imageStyle = {display: 'block', width: '100%', height: 'auto'}

/** One feature explained beside a screenshot of it */
export function FeatureDetail({
  icon,
  label,
  title,
  description,
  link,
  image,
  darkImage,
  imagePosition
}: FeatureDetailProps) {
  const hasImage = Boolean(image?.src)
  const hasDarkImage = Boolean(darkImage?.src)
  return (
    <Section>
      <div
        className={styles.root({
          image: hasImage,
          left: imagePosition === 'left'
        })}
      >
        <div className={styles.root.content()}>
          {(icon || label) && (
            <div className={styles.root.top()}>
              <SectionIcon name={icon} className={styles.root.icon()} />
              {label && <Label>{label}</Label>}
            </div>
          )}
          {title && <h2 className={styles.root.title()}>{title}</h2>}
          {description && (
            <div className={styles.root.description()}>
              <RichText
                doc={description}
                p={<p className={styles.root.text()} />}
                ul={<ul className={styles.root.checks()} />}
                li={<li className={styles.root.check()} />}
                a={<a className={styles.root.link()} />}
              />
            </div>
          )}
          <ArrowLink link={resolveLink(link)} />
        </div>
        {hasImage && (
          <div className={styles.root.frame()}>
            <Image
              {...image}
              unoptimized
              style={imageStyle}
              className={styles.root.image({light: hasDarkImage})}
            />
            {hasDarkImage && (
              <Image
                {...darkImage}
                unoptimized
                style={imageStyle}
                className={styles.root.image('dark')}
              />
            )}
          </div>
        )}
      </div>
    </Section>
  )
}
