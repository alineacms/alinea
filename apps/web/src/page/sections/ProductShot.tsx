import styler from '@alinea/styler'
import type {Infer} from 'alinea'
import NextImage from 'next/image'
import heroBg from '@/assets/hero-alinea.jpg'
import {Image} from '@/layout/Image'
import {Section} from '@/layout/Section'
import type {ProductShot as ProductShotSchema} from '@/schema/sections/ProductShot'
import {DashboardMock} from './DashboardMock'
import css from './ProductShot.module.scss'

const styles = styler(css)

export interface ProductShotProps extends Infer<typeof ProductShotSchema> {}

// The screenshot is captured at twice its 1120px layout width, see
// scripts/screenshots.ts, and served as is: resizing and re-encoding it
// through the image optimizer blurs the interface text
const imageStyle = {display: 'block', width: '100%', height: 'auto'}

export function ProductShot({image, darkImage}: ProductShotProps) {
  const hasImage = Boolean(image?.src)
  const hasDarkImage = Boolean(darkImage?.src)
  return (
    <Section flush>
      <div className={styles.root()}>
        <NextImage
          src={heroBg}
          alt=""
          fill
          priority
          placeholder="blur"
          sizes="(max-width: 1280px) 100vw, 1200px"
          className={styles.root.background()}
        />
        {hasImage ? (
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
        ) : (
          <div className={styles.root.shot()}>
            <DashboardMock
              mode="contrast"
              className={styles.root.dashboard()}
            />
          </div>
        )}
      </div>
    </Section>
  )
}
