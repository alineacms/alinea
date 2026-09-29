import styler from '@alinea/styler'
import type {Graph} from 'alinea/core/Graph'
import {Query} from 'alinea'
import {DemoCollection, DemoProduct} from '@/schema/demo'
import type {DemoLocale} from '@/schema/demo/DemoUrl'
import {
  type DemoArticleCardData,
  type DemoProductCardData,
  type DemoTarget,
  findArticleCards,
  findCollectionCards,
  findProductCards,
  targetLocale,
  targetQuery
} from '../demoData'
import {demoStrings, formatPrice} from '../demoStrings'
import {DemoArticleCard} from '../site/DemoArticleCard'
import {DemoButton} from '../site/DemoButton'
import {DemoContainer} from '../site/DemoContainer'
import {DemoImage} from '../site/DemoImage'
import {DemoProductGrid} from '../site/DemoProductGrid'
import {DemoSectionHeader} from '../site/DemoSectionHeader'
import {DemoText} from '../site/DemoText'
import css from './DemoProductPage.module.scss'

const styles = styler(css)

async function queryProduct(graph: Graph, target: DemoTarget) {
  return graph.get({
    ...targetQuery(target),
    type: DemoProduct,
    select: {
      title: DemoProduct.title,
      tagline: DemoProduct.tagline,
      badge: DemoProduct.badge,
      gallery: DemoProduct.gallery,
      description: DemoProduct.description,
      price: DemoProduct.price,
      leadTime: DemoProduct.leadTime,
      inStock: DemoProduct.inStock,
      finishes: DemoProduct.finishes,
      material: DemoProduct.material,
      designer: DemoProduct.designer,
      dimensions: DemoProduct.dimensions,
      care: DemoProduct.care,
      related: DemoProduct.related
    }
  })
}

type ProductData = Awaited<ReturnType<typeof queryProduct>>

export interface DemoProductPageProps extends ProductData {
  locale: DemoLocale
  /** Other products from the first collection this product is part of */
  collection: {
    title: string
    url: string
    products: Array<DemoProductCardData>
  } | null
  articles: Array<DemoArticleCardData>
}

function formatDimensions(dimensions: ProductData['dimensions']) {
  const {width, depth, height} = dimensions ?? {}
  const sizes = [width, depth, height].filter(
    (size): size is number => typeof size === 'number'
  )
  if (sizes.length === 0) return null
  return `${sizes.join(' × ')} cm`
}

export function DemoProductPage({
  locale,
  title,
  tagline,
  badge,
  gallery,
  description,
  price,
  leadTime,
  finishes,
  material,
  designer,
  dimensions,
  care,
  collection,
  articles
}: DemoProductPageProps) {
  const t = demoStrings(locale)
  const [main, ...rest] = gallery ?? []
  const options = finishes ?? []
  const firstAvailable = Math.max(
    0,
    options.findIndex(finish => (finish.stock ?? 0) > 0)
  )
  const inStock = (options[firstAvailable]?.stock ?? 0) > 0
  const size = formatDimensions(dimensions)
  const materialLabel =
    t.materials[material as keyof typeof t.materials] ?? material
  const details = [
    {label: t.material, value: materialLabel},
    {label: t.dimensions, value: size},
    {
      label: t.weight,
      value: dimensions?.weight ? `${dimensions.weight} kg` : null
    },
    {label: t.designer, value: designer}
  ].filter(detail => detail.value)
  return (
    <div className={styles.DemoProductPage()}>
      <DemoContainer>
        <div className={styles.DemoProductPage.layout()}>
          <div className={styles.DemoProductPage.gallery()}>
            <div className={styles.DemoProductPage.gallery.main()}>
              <DemoImage image={main} ratio="4 / 5" eager />
              {badge && (
                <span className={styles.DemoProductPage.badge()}>{badge}</span>
              )}
            </div>
            {rest.map(image => (
              <DemoImage
                key={image._id}
                image={image}
                ratio="4 / 5"
                className={styles.DemoProductPage.gallery.image()}
              />
            ))}
          </div>
          <div className={styles.DemoProductPage.info()}>
            <h1 className={styles.DemoProductPage.title()}>{title}</h1>
            {tagline && (
              <p className={styles.DemoProductPage.tagline()}>{tagline}</p>
            )}
            <p className={styles.DemoProductPage.price()}>
              {formatPrice(locale, price)}
            </p>
            {options.length > 0 && (
              <fieldset className={styles.DemoProductPage.finishes()}>
                <legend className={styles.DemoProductPage.label()}>
                  {t.finish}
                </legend>
                <div className={styles.DemoProductPage.options()}>
                  {options.map((finish, index) => (
                    <label
                      key={finish._id}
                      className={styles.DemoProductPage.option()}
                    >
                      <input
                        type="radio"
                        name="finish"
                        defaultChecked={index === firstAvailable}
                        className={styles.DemoProductPage.option.input()}
                      />
                      <span
                        className={styles.DemoProductPage.option.swatch()}
                        style={{background: finish.swatch}}
                      />
                      <span className={styles.DemoProductPage.option.label()}>
                        {finish.name}
                      </span>
                      {finish.surcharge ? (
                        <span
                          className={styles.DemoProductPage.option.surcharge()}
                        >
                          +{formatPrice(locale, finish.surcharge)}
                        </span>
                      ) : null}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <div className={styles.DemoProductPage.actions()}>
              <DemoButton>{t.addToBasket}</DemoButton>
              <p className={styles.DemoProductPage.availability({inStock})}>
                <span className={styles.DemoProductPage.availability.dot()} />
                {inStock || !leadTime ? t.shipsNow : t.shipsIn(leadTime)}
              </p>
            </div>
            <DemoText doc={description} locale={locale} />
            {details.length > 0 && (
              <dl className={styles.DemoProductPage.details()}>
                {details.map(detail => (
                  <div
                    key={detail.label}
                    className={styles.DemoProductPage.detail()}
                  >
                    <dt className={styles.DemoProductPage.detail.label()}>
                      {detail.label}
                    </dt>
                    <dd className={styles.DemoProductPage.detail.value()}>
                      {detail.value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {care && (
              <details className={styles.DemoProductPage.care()}>
                <summary className={styles.DemoProductPage.care.summary()}>
                  {t.care}
                </summary>
                <p className={styles.DemoProductPage.care.text()}>{care}</p>
              </details>
            )}
          </div>
        </div>
      </DemoContainer>
      {collection && collection.products.length > 0 && (
        <DemoContainer className={styles.DemoProductPage.section()}>
          <DemoSectionHeader
            title={t.moreFrom(collection.title)}
            link={{href: collection.url, label: t.viewCollection}}
          />
          <DemoProductGrid locale={locale} products={collection.products} />
        </DemoContainer>
      )}
      {articles.length > 0 && (
        <DemoContainer className={styles.DemoProductPage.section()}>
          <DemoSectionHeader title={t.relatedArticles} />
          <div className={styles.DemoProductPage.articles()}>
            {articles.map(article => (
              <DemoArticleCard
                key={article.id}
                locale={locale}
                article={article}
                featured={articles.length === 1}
              />
            ))}
          </div>
        </DemoContainer>
      )}
    </div>
  )
}

DemoProductPage.query = async (
  graph: Graph,
  target: DemoTarget
): Promise<DemoProductPageProps> => {
  const locale = targetLocale(target)
  const [product, allArticles, collectionIds] = await Promise.all([
    queryProduct(graph, target),
    findArticleCards(graph, locale),
    graph.find({
      workspace: 'demo',
      root: 'pages',
      type: DemoCollection,
      select: Query.id
    })
  ])
  const allCollections = await findCollectionCards(
    graph,
    Array.from(new Set(collectionIds)),
    locale
  )
  const parent = allCollections.find(collection =>
    collection.products?.some(link => link.entryId === target.id)
  )
  const siblings = parent
    ? await findProductCards(
        graph,
        (parent.products ?? [])
          .map(link => link.entryId)
          .filter(id => id !== target.id)
          .slice(0, 4),
        locale
      )
    : []
  const collection = parent
    ? {title: parent.title, url: parent.url, products: siblings}
    : null
  const related = (product.related ?? []).map(link => link.entryId)
  const articles = related.flatMap(id =>
    allArticles.filter(article => article.id === id)
  )
  return {...product, locale, collection, articles}
}
