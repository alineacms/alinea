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

export function ProductShot({image}: ProductShotProps) {
  const hasImage = Boolean(image?.src)
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
          <Image
            {...image}
            sizes="(max-width: 1024px) 100vw, 960px"
            style={{display: 'block', width: '100%', height: 'auto'}}
            className={styles.root.image()}
          />
        ) : (
          <div className={styles.root.shot()}>
            <DashboardMock mode="auto" className={styles.root.dashboard()} />
          </div>
        )}
      </div>
    </Section>
  )
}
