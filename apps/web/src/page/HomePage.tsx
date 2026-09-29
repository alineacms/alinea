import styler from '@alinea/styler'
import {Query} from 'alinea'
import type {Metadata, MetadataRoute} from 'next'
import {cms} from '@/cms'
import {Button} from '@/layout/Button'
import {CopyPrompt} from '@/layout/CopyPrompt'
import {InstallCommand} from '@/layout/InstallCommand'
import {JsonLd} from '@/layout/JsonLd'
import WebLayout from '@/layout/WebLayout'
import {type LabeledLink, resolveLink} from '@/page/sections/links'
import {Sections} from '@/page/sections/Sections'
import {Home} from '@/schema/Home'
import {getMetadata, siteName, siteUrl} from '@/utils/metadata'
import css from './HomePage.module.scss'

const styles = styler(css)

export async function generateMetadata(): Promise<Metadata> {
  const page = await cms.get({
    type: Home,
    select: {
      url: Query.url,
      title: Home.title,
      metadata: Home.metadata
    }
  })
  return await getMetadata(page)
}

interface HomeHeroProps {
  headline?: string
  byline?: string
  button?: LabeledLink | null
  link?: LabeledLink | null
  command?: string
  prompt?: string
}

function HomeHero({
  headline,
  byline,
  button,
  link,
  command,
  prompt
}: HomeHeroProps) {
  const [first, ...rest] = (headline ?? '').split('\n')
  const primary = resolveLink(button)
  const secondary = resolveLink(link)
  return (
    <header className={styles.hero()}>
      {headline && (
        <h1 className={styles.hero.title()}>
          {first}
          {rest.length > 0 && (
            <>
              <br />
              <span className={styles.hero.accent()}>{rest.join('\n')}</span>
            </>
          )}
        </h1>
      )}
      {byline && <p className={styles.hero.byline()}>{byline}</p>}
      <div className={styles.hero.actions()}>
        {primary && (
          <Button href={primary.href} target={primary.target}>
            {primary.label}
          </Button>
        )}
        {secondary && (
          <Button
            variant="secondary"
            href={secondary.href}
            target={secondary.target}
          >
            {secondary.label}
          </Button>
        )}
        <InstallCommand command={command || undefined} />
      </div>
      {prompt && (
        <CopyPrompt
          prompt={prompt}
          align="center"
          className={styles.hero.prompt()}
        />
      )}
    </header>
  )
}

const repository = 'https://github.com/alineacms/alinea'

/** Describes Alinea, its makers and this website for search engines */
function homeStructuredData(description?: string) {
  const organization = {
    '@type': 'Organization',
    '@id': `${siteUrl}/#organization`,
    name: 'Alinea',
    url: siteUrl,
    logo: `${siteUrl}/icon.svg`,
    sameAs: ['https://github.com/alineacms']
  }
  return {
    '@graph': [
      organization,
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}/#website`,
        name: siteName,
        alternateName: 'Alinea',
        url: siteUrl,
        description,
        publisher: {'@id': organization['@id']}
      },
      {
        '@type': 'SoftwareApplication',
        name: 'Alinea',
        alternateName: siteName,
        description,
        url: siteUrl,
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Cross-platform',
        license: `${repository}/blob/main/LICENSE`,
        offers: {'@type': 'Offer', price: 0, priceCurrency: 'USD'},
        sameAs: [repository, 'https://www.npmjs.com/package/alinea'],
        author: {'@id': organization['@id']}
      }
    ]
  }
}

export default async function HomePage() {
  const home = await cms.get({type: Home})
  return (
    <WebLayout>
      <JsonLd data={homeStructuredData(home.metadata?.description)} />
      <main className={styles.home()}>
        <HomeHero {...home.hero} />
        <Sections sections={home.sections} />
      </main>
    </WebLayout>
  )
}

HomePage.sitemap = (): MetadataRoute.Sitemap => {
  return [{url: '/', priority: 1}]
}
