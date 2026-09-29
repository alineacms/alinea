import styler from '@alinea/styler'
import type {DemoLocale} from '@/schema/demo/DemoUrl'
import type {DemoArticleCardData} from '../demoData'
import {demoStrings, formatDate} from '../demoStrings'
import {DemoImage} from './DemoImage'
import css from './DemoArticleCard.module.scss'

const styles = styler(css)

export interface DemoArticleCardProps {
  locale: DemoLocale
  article: DemoArticleCardData
  /** Show a larger card with the intro */
  featured?: boolean
}

export function DemoArticleCard({
  locale,
  article,
  featured
}: DemoArticleCardProps) {
  const t = demoStrings(locale)
  const category =
    t.categories[article.category as keyof typeof t.categories] ??
    article.category
  return (
    <a href={article.url} className={styles.DemoArticleCard({featured})}>
      <DemoImage
        image={article.cover}
        ratio={featured ? '16 / 10' : '3 / 2'}
        className={styles.DemoArticleCard.image()}
      />
      <div className={styles.DemoArticleCard.body()}>
        <p className={styles.DemoArticleCard.meta()}>
          <span className={styles.DemoArticleCard.meta.category()}>
            {category}
          </span>
          <span>{formatDate(locale, article.publishDate)}</span>
          {article.locale !== locale && (
            <span className={styles.DemoArticleCard.meta.language()}>
              {t.englishOnly}
            </span>
          )}
        </p>
        <h3 className={styles.DemoArticleCard.title()}>{article.title}</h3>
        {article.intro && (
          <p className={styles.DemoArticleCard.intro()}>{article.intro}</p>
        )}
      </div>
    </a>
  )
}
