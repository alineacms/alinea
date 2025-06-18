import styler from '@alinea/styler'
import {Entry} from 'alinea/core/Entry'
import {IcRoundInsertDriveFile} from 'alinea/ui/icons/IcRoundInsertDriveFile'
import {IcRoundPublish} from 'alinea/ui/icons/IcRoundPublish'
import {PhGlobe} from 'alinea/ui/icons/PhGlobe'
import {RiFlashlightFill} from 'alinea/ui/icons/RiFlashlightFill'
import {HStack, VStack} from 'alinea/ui/Stack'
import {px} from 'alinea/ui/util/Units'
import type {Metadata, MetadataRoute} from 'next'
import type {ComponentType, PropsWithChildren} from 'react'
import heroBg from '@/assets/hero-alinea.jpg'
import {cms} from '@/cms'
import {
  IcBaselineCloudQueue,
  IcBaselineDashboardCustomize,
  IcBaselineWorkspaces,
  IcRoundFastForward,
  MdiLanguageTypescript,
  MdiSourceBranch
} from '@/icons'
import {Feature, Features} from '@/layout/Features'
import {Hero} from '@/layout/Hero'
import {PageContainer} from '@/layout/Page'
import WebLayout from '@/layout/WebLayout'
import {WebTypo} from '@/layout/WebTypo'
import {Home} from '@/schema/Home'
import {Link} from '../layout/nav/Link'
import css from './HomePage.module.scss'

const styles = styler(css)

export async function generateMetadata(): Promise<Metadata> {
  const page = await cms.get({
    type: Home,
    select: {
      url: Entry.url,
      title: Home.title,
      metadata: Home.metadata
    }
  })
  const appUrl = 'https://alinea.sh'
  const title = page.metadata?.title || page.title
  const ogTitle = page.metadata?.openGraph?.title || title
  const ogDescription =
    page.metadata?.openGraph?.description || page.metadata?.description
  const openGraphImage = page.metadata?.openGraph.image

  return {
    metadataBase: new URL(appUrl),
    title,
    description: page.metadata?.description,
    openGraph: {
      url: appUrl + page.url,
      siteName: page.metadata?.openGraph?.siteName,
      title: ogTitle,
      description: ogDescription,
      images: openGraphImage?.src && {
        url: openGraphImage.src,
        width: openGraphImage.width,
        height: openGraphImage.height
      }
    }
  }
}

interface HighlightProps {
  icon: ComponentType
  href: string
}

function Highlight({
  href,
  icon: Icon,
  children
}: PropsWithChildren<HighlightProps>) {
  return (
    <Link className={styles.highlight()} href={href}>
      <HStack gap={10}>
        <Icon />
        <span style={{lineHeight: 1}}>{children}</span>
      </HStack>
    </Link>
  )
}

export default async function HomePage() {
  const home = await cms.get({type: Home})
  return (
    <WebLayout>
      <main className={styles.home()}>
        <PageContainer>
          <div
            className={styles.hero()}
            style={{backgroundImage: `url(${heroBg.src})`}}
          >
            <VStack center>
              <Hero.Title>{home.headline}</Hero.Title>
              <Hero.ByLine>{home.byline}</Hero.ByLine>
              <HStack gap={24} style={{paddingTop: px(20)}}>
                {home.action?.href && (
                  <Hero.Action href={home.action.href}>
                    {home.action.fields.label}
                  </Hero.Action>
                )}
                {/*<WebTypo.Link
                  className={styles.hero.demo()}
                  href="https://demo.alinea.sh"
                  target="_blank"
                >
                  <div>
                    <span>Try the demo</span>
                  </div>
                </WebTypo.Link>*/}
              </HStack>
            </VStack>
          </div>
        </PageContainer>

        <PageContainer>
          <VStack gap={40}>
            <Features>
              <Feature>
                <WebTypo>
                  <Feature.Title icon={IcRoundFastForward}>
                    Minimal setup
                  </Feature.Title>
                  <WebTypo.P>
                    Go straight to content modeling without having to deal with
                    databases and migrations.
                  </WebTypo.P>
                </WebTypo>
              </Feature>
              <Feature>
                <WebTypo>
                  <Feature.Title icon={MdiSourceBranch}>
                    Git based
                  </Feature.Title>
                  <WebTypo.P>
                    Content is version controlled in your git repository. Easily
                    branch and feature test content changes.
                  </WebTypo.P>
                </WebTypo>
              </Feature>
              <Feature>
                <WebTypo>
                  <Feature.Title icon={MdiLanguageTypescript}>
                    Fully typed
                  </Feature.Title>
                  <WebTypo.P>
                    An optimized, type-safe experience for Typescript users
                    without overcomplicating things.
                  </WebTypo.P>
                </WebTypo>
              </Feature>
            </Features>
          </VStack>
        </PageContainer>

        <section className={styles.home.section()}>
          <VStack gap={50}>
            <PageContainer>
              <WebTypo>
                <WebTypo.H2>User friendly dashboard</WebTypo.H2>
              </WebTypo>
              <div className={styles.home.demo()}>
                <iframe
                  src="https://demo.alinea.sh"
                  className={styles.home.demo.inner()}
                />
              </div>
            </PageContainer>
          </VStack>
        </section>

        <HStack justify="space-between" gap={`${px(16)} ${px(30)}`} wrap>
          <Highlight href="/docs/content/live-previews" icon={RiFlashlightFill}>
            Live previews
          </Highlight>

          <Highlight
            icon={IcRoundPublish}
            href="/blog/alinea-0-4-0#content-workflow"
          >
            Editorial workflow
          </Highlight>

          <Highlight icon={IcRoundInsertDriveFile} href="/docs/content/query">
            Query engine
          </Highlight>

          <Highlight
            icon={IcBaselineDashboardCustomize}
            href="/docs/fields/custom-fields"
          >
            Custom fields
          </Highlight>

          <Highlight
            icon={IcBaselineWorkspaces}
            href="/docs/configuration/workspaces"
          >
            Workspaces
          </Highlight>

          <Highlight icon={PhGlobe} href="/docs/reference/internationalization">
            Internationalization
          </Highlight>

          <Highlight icon={IcBaselineCloudQueue} href="/docs/deploy">
            Self-host or cloud host
          </Highlight>
        </HStack>

        <section className={styles.home.section()}>
          <PageContainer>
            <WebTypo.H2>Code your schema</WebTypo.H2>
            <WebTypo.P>
              Configuration as code saves you from clicking endlessly through a
              UI to define fields. Easily branch and feature test schema
              changes.
            </WebTypo.P>
          </PageContainer>
        </section>

        <section className={styles.home.section()}>
          <PageContainer>
            <WebTypo.H2>Live previews</WebTypo.H2>
            <WebTypo.P>
              React to dashboard changes by previewing a live page view.
            </WebTypo.P>
          </PageContainer>
        </section>

        <section className={styles.home.section()}>
          <PageContainer>
            <WebTypo.H2>Query content</WebTypo.H2>
            <WebTypo.P>
              Use an ORM like API to query field contents. Content is bundled
              with your code and directly available without network roundtrips.
            </WebTypo.P>
          </PageContainer>
        </section>

        <section className={styles.home.section()}>
          <PageContainer>
            <WebTypo.H2>Works with any framework</WebTypo.H2>
            <WebTypo.P>Pick your favorite and get started.</WebTypo.P>
          </PageContainer>
        </section>
        {/*

        I think below we should highlight in separate (interactive) sections:
        - [x] config as code => preview how to build a schema
        - [x] live previews
        - [x] query engine
        - [ ] custom fields
        - [ ] the editing/dashboard experience
        - [ ] deploy "anywhere": node or edge deploys

      

      <section className={styles.home.section()}>
        <PageContainer>
          <WebTypo.H2>Code your schema</WebTypo.H2>
          <WebTypo.P>
            Configuration as code saves you from clicking endlessly through a UI
            to define fields. Easily branch and feature test schema changes.
          </WebTypo.P>
        </PageContainer>
      </section>

      <section className={styles.home.section()}>
        <PageContainer>
          <WebTypo.H2>Live previews</WebTypo.H2>
          <WebTypo.P>
            React to dashboard changes by previewing a live page view.
          </WebTypo.P>
        </PageContainer>
      </section>

      <section className={styles.home.section()}>
        <PageContainer>
          <WebTypo.H2>Query content</WebTypo.H2>
          <WebTypo.P>
            Use an ORM like API to query field contents. Content is bundled with
            your code and directly available without network roundtrips.
          </WebTypo.P>
        </PageContainer>
      </section>

      <section className={styles.home.section()}>
        <PageContainer>
          <WebTypo.H2>Works with any framework</WebTypo.H2>
          <WebTypo.P>Pick your favorite and get started.</WebTypo.P>
        </PageContainer>
      </section>

      <section className={styles.home.section()}>
        <PageContainer>
          <WebTypo.H2>Powerful fields</WebTypo.H2>
          <WebTypo.P>
            Alinea ships with a comprehensive set of fields that allow you to
            structure complex web apps.
          </WebTypo.P>
        </PageContainer>
      </section>*/}
      </main>
    </WebLayout>
  )
}

HomePage.sitemap = (): MetadataRoute.Sitemap => {
  return [{url: '/', priority: 1}]
}
