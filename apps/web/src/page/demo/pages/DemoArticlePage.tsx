import styler from '@alinea/styler'
import type {Infer} from 'alinea'
import type {Graph} from 'alinea/core/Graph'
import {DemoArticle, DemoAuthor} from '@/schema/demo'
import type {DemoLocale} from '@/schema/demo/DemoUrl'
import {
  type DemoArticleCardData,
  type DemoProductCardData,
  type DemoTarget,
  findArticleCards,
  findProductCards,
  targetLocale,
  targetQuery
} from '../demoData'
import {demoStrings, formatDate} from '../demoStrings'
import {DemoArticleCard} from '../site/DemoArticleCard'
import {DemoContainer} from '../site/DemoContainer'
import {DemoImage} from '../site/DemoImage'
import {DemoSectionHeader} from '../site/DemoSectionHeader'
import {DemoText} from '../site/DemoText'
import css from './DemoArticlePage.module.scss'

const styles = styler(css)

const articleSelection = {
  title: DemoArticle.title,
  intro: DemoArticle.intro,
  body: DemoArticle.body,
  cover: DemoArticle.cover,
  coverCredit: DemoArticle.coverCredit,
  category: DemoArticle.category,
  publishDate: DemoArticle.publishDate,
  readingTime: DemoArticle.readingTime,
  author: DemoArticle.author.first({
    select: {
      name: DemoAuthor.title,
      role: DemoAuthor.role,
      bio: DemoAuthor.bio
    }
  })
}

type ArticleData = Infer<typeof articleSelection>

export interface DemoArticlePageProps extends ArticleData {
  locale: DemoLocale
  products: Array<DemoProductCardData>
  more: Array<DemoArticleCardData>
}

function initials(name: string) {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .slice(0, 2)
}

export function DemoArticlePage({
  locale,
  title,
  intro,
  body,
  cover,
  coverCredit,
  category,
  publishDate,
  readingTime,
  author,
  products,
  more
}: DemoArticlePageProps) {
  const t = demoStrings(locale)
  const categoryLabel =
    t.categories[category as keyof typeof t.categories] ?? category
  return (
    <article className={styles.DemoArticlePage()}>
      <DemoContainer width="narrow">
        <header className={styles.DemoArticlePage.header()}>
          <p className={styles.DemoArticlePage.meta()}>
            <span className={styles.DemoArticlePage.meta.category()}>
              {categoryLabel}
            </span>
            <span>{formatDate(locale, publishDate)}</span>
            {readingTime ? <span>{t.minutes(readingTime)}</span> : null}
          </p>
          <h1 className={styles.DemoArticlePage.title()}>{title}</h1>
          {intro && <p className={styles.DemoArticlePage.intro()}>{intro}</p>}
          {author && (
            <p className={styles.DemoArticlePage.byline()}>
              <span className={styles.DemoArticlePage.avatar()}>
                {initials(author.name)}
              </span>
              <span>
                {t.by} <strong>{author.name}</strong>
                {author.role && `, ${author.role.toLowerCase()}`}
              </span>
            </p>
          )}
        </header>
      </DemoContainer>
      <DemoContainer>
        <figure className={styles.DemoArticlePage.cover()}>
          <DemoImage
            image={cover}
            ratio="16 / 9"
            eager
            className={styles.DemoArticlePage.cover.image()}
          />
          {coverCredit && (
            <figcaption className={styles.DemoArticlePage.cover.credit()}>
              {coverCredit}
            </figcaption>
          )}
        </figure>
      </DemoContainer>
      <DemoContainer width="narrow">
        <DemoText doc={body} locale={locale} products={products} />
        {author?.bio && (
          <aside className={styles.DemoArticlePage.author()}>
            <span className={styles.DemoArticlePage.avatar({large: true})}>
              {initials(author.name)}
            </span>
            <div>
              <p className={styles.DemoArticlePage.author.heading()}>
                {author.name}
              </p>
              <p className={styles.DemoArticlePage.author.bio()}>
                {author.bio}
              </p>
            </div>
          </aside>
        )}
      </DemoContainer>
      {more.length > 0 && (
        <DemoContainer className={styles.DemoArticlePage.more()}>
          <DemoSectionHeader title={t.relatedArticles} />
          <div className={styles.DemoArticlePage.more.grid()}>
            {more.map(article => (
              <DemoArticleCard
                key={article.id}
                locale={locale}
                article={article}
              />
            ))}
          </div>
        </DemoContainer>
      )}
    </article>
  )
}

function calloutProductIds(body: ArticleData['body']): Array<string> {
  return (body ?? []).flatMap(node =>
    node._type === 'DemoProductCallout' && 'product' in node
      ? [(node.product as {entryId?: string} | null)?.entryId ?? '']
      : []
  )
}

DemoArticlePage.query = async (
  graph: Graph,
  target: DemoTarget
): Promise<DemoArticlePageProps> => {
  const locale = targetLocale(target)
  const article = await graph.get({
    ...targetQuery(target),
    type: DemoArticle,
    select: articleSelection
  })
  const [products, more] = await Promise.all([
    findProductCards(
      graph,
      calloutProductIds(article.body).filter(Boolean),
      locale
    ),
    findArticleCards(graph, locale, 3, target.id)
  ])
  return {...article, locale, products, more}
}
