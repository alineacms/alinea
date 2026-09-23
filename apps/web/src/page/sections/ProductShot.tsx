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

// The screenshot is shown at most this wide, see ProductShot.module.scss
const imageSizes = '(max-width: 439px) 640px, (max-width: 1023px) 880px, 1120px'
const imageStyle = {display: 'block', width: '100%', height: 'auto'}

export function ProductShot({image, darkImage}: ProductShotProps) {
  const hasImage = Boolean(image?.src)
  const hasDarkImage = Boolean(darkImage?.src)
  return (
    <Section flush>
      <div className={styles.root({image: hasImage})}>
        <NextImage
          src={heroBg}
          alt=""
          fill
          priority
          placeholder="blur"
          sizes="(max-width: 1440px) 100vw, 1280px"
          className={styles.root.background()}
        />
        {hasImage ? (
          <div className={styles.root.frame()}>
            <Image
              {...image}
              sizes={imageSizes}
              style={imageStyle}
              className={styles.root.image({light: hasDarkImage})}
            />
            {hasDarkImage && (
              <Image
                {...darkImage}
                sizes={imageSizes}
                style={imageStyle}
                className={styles.root.image('dark')}
              />
            )}
          </div>
        ) : (
          <div className={styles.root.shot()}>
            <DashboardMock mode="auto" className={styles.root.dashboard()} />
          </div>
        )}
      </div>
    </Section>
  )
}
