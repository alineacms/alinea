import styler from '@alinea/styler'
import type {Infer} from 'alinea'
import Link from 'next/link'
import NextImage from 'next/image'
import heroBg from '@/assets/hero-alinea.jpg'
import {Image} from '@/layout/Image'
import {Section} from '@/layout/Section'
import type {ProductShot as ProductShotSchema} from '@/schema/sections/ProductShot'
import {DashboardMock} from './DashboardMock'
import {resolveLink} from './links'
import {ProductShotStage} from './ProductShot.client'
import css from './ProductShot.module.scss'
import {SectionIcon} from './SectionIcon'

const styles = styler(css)

export interface ProductShotProps extends Infer<typeof ProductShotSchema> {}

// The screenshot is captured at twice its 1120px layout width, see
// scripts/screenshots.ts, and served as is: resizing and re-encoding it
// through the image optimizer blurs the interface text
const imageStyle = {display: 'block', width: '100%', height: 'auto'}

type ProductShotFeature = ProductShotProps['features'][number]

interface ProductShotFeaturesProps {
  features: Array<ProductShotFeature>
  /** On the image on wide screens, above it on small ones */
  placement: 'image' | 'above'
  /** The screenshot shown while each feature is hovered, 0 is the main one */
  shots: Array<number>
}

/** The highlighted features, each linking to more about it */
function ProductShotFeatures({
  features,
  placement,
  shots
}: ProductShotFeaturesProps) {
  return (
    <ul className={styles.features({[placement]: true})}>
      {features.map((feature, index) => {
        const link = resolveLink(feature.link)
        return (
          <li
            key={feature._id}
            data-shot={shots[index]}
            className={styles.features.item()}
          >
            <span className={styles.features.icon()}>
              <SectionIcon name={feature.icon} />
            </span>
            <div className={styles.features.body()}>
              <h3 className={styles.features.title()}>
                {link ? (
                  <Link
                    href={link.href}
                    target={link.target}
                    className={styles.features.link()}
                  >
                    {feature.title}
                    <span
                      aria-hidden="true"
                      className={styles.features.arrow()}
                    >
                      →
                    </span>
                  </Link>
                ) : (
                  feature.title
                )}
              </h3>
              {feature.text && (
                <p className={styles.features.text()}>{feature.text}</p>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

interface Shot {
  image: ProductShotProps['image']
  darkImage: ProductShotProps['darkImage']
}

interface ProductShotFrameProps {
  shots: Array<Shot>
}

/** The screenshots, stacked: the stylesheet shows the active one */
function ProductShotFrame({shots}: ProductShotFrameProps) {
  return (
    <div className={styles.root.frame()}>
      {shots.map(({image, darkImage}, index) => {
        const hasDarkImage = Boolean(darkImage?.src)
        return (
          <div
            key={index}
            data-shot={index}
            className={styles.root.layer()}
            aria-hidden={index > 0 || undefined}
          >
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
        )
      })}
    </div>
  )
}

export function ProductShot({image, darkImage, features}: ProductShotProps) {
  const hasImage = Boolean(image?.src)
  const hasFeatures = features?.length > 0
  // The main screenshot first, then one for every feature that has its own
  const shots: Array<Shot> = [{image, darkImage}]
  const featureShots = (features ?? []).map(feature => {
    if (!feature.image?.src) return 0
    shots.push({image: feature.image, darkImage: feature.darkImage})
    return shots.length - 1
  })
  return (
    <Section flush>
      <ProductShotStage className={styles.layout()}>
        {hasFeatures && (
          <ProductShotFeatures
            features={features}
            placement="above"
            shots={featureShots}
          />
        )}
        <div className={styles.root({features: hasFeatures})}>
          <NextImage
            src={heroBg}
            alt=""
            fill
            priority
            placeholder="blur"
            sizes="(max-width: 1280px) 100vw, 1200px"
            className={styles.root.background()}
          />
          {hasFeatures && (
            <ProductShotFeatures
              features={features}
              placement="image"
              shots={featureShots}
            />
          )}
          {hasImage ? (
            <ProductShotFrame shots={shots} />
          ) : (
            <div className={styles.root.shot()}>
              <DashboardMock
                mode="contrast"
                className={styles.root.dashboard()}
              />
            </div>
          )}
        </div>
      </ProductShotStage>
    </Section>
  )
}
