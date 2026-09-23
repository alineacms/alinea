import styler from '@alinea/styler'
import type {Infer, TextDoc} from 'alinea'
import {RichText} from 'alinea/ui'
import type {
  DemoArticleImage,
  DemoProductCallout
} from '@/schema/demo/DemoArticle'
import type {DemoLocale} from '@/schema/demo/DemoUrl'
import type {DemoProductCardData} from '../demoData'
import {DemoImage} from './DemoImage'
import {DemoProductCalloutView} from './DemoProductCalloutView'
import css from './DemoText.module.scss'

const styles = styler(css)

interface DemoTextBlocks {
  DemoProductCallout: typeof DemoProductCallout
  DemoArticleImage: typeof DemoArticleImage
}

export interface DemoTextProps {
  doc: TextDoc<DemoTextBlocks> | TextDoc | null | undefined
  locale: DemoLocale
  /** Product cards for product callouts in the text */
  products?: Array<DemoProductCardData>
  size?: 'default' | 'large'
}

export function DemoText({doc, locale, products = [], size}: DemoTextProps) {
  if (!doc?.length) return null
  return (
    <div className={styles.DemoText({large: size === 'large'})}>
      <RichText
        doc={doc as TextDoc<DemoTextBlocks>}
        p={<p className={styles.DemoText.p()} />}
        h2={<h2 className={styles.DemoText.h2()} />}
        h3={<h3 className={styles.DemoText.h3()} />}
        ul={<ul className={styles.DemoText.list()} />}
        ol={<ol className={styles.DemoText.list()} />}
        li={<li className={styles.DemoText.item()} />}
        a={<a className={styles.DemoText.link()} />}
        b={<strong className={styles.DemoText.strong()} />}
        DemoProductCallout={(block: Infer<typeof DemoProductCallout>) => {
          const product = products.find(
            card => card.id === block.product?.entryId
          )
          if (!product) return null
          return (
            <DemoProductCalloutView
              locale={locale}
              product={product}
              note={block.note}
            />
          )
        }}
        DemoArticleImage={({
          image,
          caption
        }: Infer<typeof DemoArticleImage>) => (
          <figure className={styles.DemoText.figure()}>
            <DemoImage
              image={image}
              ratio="3 / 2"
              className={styles.DemoText.figure.image()}
            />
            {caption && (
              <figcaption className={styles.DemoText.figure.caption()}>
                {caption}
              </figcaption>
            )}
          </figure>
        )}
      />
    </div>
  )
}
