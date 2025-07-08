import styler from '@alinea/styler'
import {Entry} from 'alinea/core/Entry'
import {Icon} from 'alinea/ui/Icon'
import {IcRoundAccountTree} from 'alinea/ui/icons/IcRoundAccountTree'
import {IcRoundInsertDriveFile} from 'alinea/ui/icons/IcRoundInsertDriveFile'
import {IcRoundOpenInNew} from 'alinea/ui/icons/IcRoundOpenInNew'
import {IcRoundPublish} from 'alinea/ui/icons/IcRoundPublish'
import {PhGlobe} from 'alinea/ui/icons/PhGlobe'
import {RiFlashlightFill} from 'alinea/ui/icons/RiFlashlightFill'
import {HStack, VStack} from 'alinea/ui/Stack'
import {px} from 'alinea/ui/util/Units'
import type {Metadata, MetadataRoute} from 'next'
import NextImage from 'next/image.js'
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
import {Image} from '../layout/Image'
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
  const appUrl = 'https://alineacms.com'
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
    <WebLayout footer={false}>
      <main className={styles.home()}>
        <PageContainer>
          <div className={styles.hero()}>
            <NextImage
              priority
              fetchPriority="high"
              src={heroBg.src}
              placeholder="blur"
              blurDataURL={heroBg.blurDataURL}
              sizes="(max-width: 1440px) 100vw, 1280px"
              fill
              alt="Background"
              style={{objectFit: 'cover', zIndex: -1}}
            />
            <VStack center>
              <Hero.Title>{home.headline}</Hero.Title>
              <Hero.ByLine>{home.byline}</Hero.ByLine>
              <HStack
                wrap
                gap={`${px(16)} ${px(24)}`}
                center
                style={{paddingTop: px(20)}}
                justify="center"
              >
                {home.action?.href && (
                  <Hero.Action href={home.action.href}>
                    {home.action.fields.label}
                  </Hero.Action>
                )}
                <WebTypo.Link
                  className={styles.hero.demo()}
                  href="https://alineacms.com/demo"
                  target="_blank"
                >
                  <HStack gap={8} center>
                    <span>Try a demo</span>
                    <Icon icon={IcRoundOpenInNew} />
                  </HStack>
                </WebTypo.Link>
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
                    Straightforward content modeling without{'\n'}dealing with
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
                    Version controlled content in your repository.{'\n'}Easily
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
                    without overcomplication.
                  </WebTypo.P>
                </WebTypo>
              </Feature>
            </Features>
          </VStack>
        </PageContainer>

        {/*<PageContainer>
          <VStack gap={40}>
            <section className={styles.home.section()}>
              <WebTypo>
                <Feature.Title icon={IcRoundAccountTree}>
                  Intuitive Content Tree
                </Feature.Title>
                <WebTypo.P>
                  Organize content in a clear, hierarchical structure, like a
                  family tree or a file system. Editors can easily navigate,
                  reorder, and manage pages in a way that makes sense for any
                  project. Navigation stays simple, whether you’re editing in
                  the dashboard or working with the API.
                </WebTypo.P>
              </WebTypo>

              <Image
                alt="Alinea content tree screenshot"
                {...screenshot}
                sizes="(max-width: 700px) 100vw, 700px"
                className={styles.home.section.screenshot()}
              />
            </section>

            <WebTypo.H2 style={{textAlign: 'center'}}>
              Describe your schema in code, review it in Git
            </WebTypo.H2>

            <section className={styles.home.section()}>
              <WebTypo>
                <Feature.Title icon={IcBaselineWorkspaces}>
                  Configuration as Code
                </Feature.Title>
                <WebTypo.P>
                  Define your content schema in code. No endless clicking
                  through forms. Branch, test, and evolve your structure with
                  the same developer workflow you use for your site.
                </WebTypo.P>
                <WebTypo.Link href="/docs/configuration">
                  Read more
                </WebTypo.Link>
              </WebTypo>
            </section>
            <section className={styles.home.section()}>
              <WebTypo>
                <Feature.Title icon={IcRoundInsertDriveFile}>
                  Powerful Query Engine
                </Feature.Title>
                <WebTypo.P>
                  Query your content like an ORM. Content is bundled with your
                  code, eliminating unnecessary network calls and keeping your
                  site fast.
                </WebTypo.P>
                <WebTypo.Link href="/docs/content/query">
                  Read more
                </WebTypo.Link>
              </WebTypo>
            </section>

            <WebTypo.H2 style={{textAlign: 'center'}}>
              Content is local, versioned, and deploys with your site.
            </WebTypo.H2>

            <section className={styles.home.section()}>
              <WebTypo>
                <Feature.Title icon={RiFlashlightFill}>
                  Live Previews
                </Feature.Title>
                <WebTypo.P>
                  See exactly what your content changes look in real time.
                  Preview updates instantly, right inside the dashboard. Full
                  support for React Server Components without any extra setup.
                </WebTypo.P>
                <WebTypo.Link href="/docs/content/live-previews">
                  Read more
                </WebTypo.Link>
              </WebTypo>
            </section>

            <section className={styles.home.section()}>
              <WebTypo>
                <Feature.Title icon={IcBaselineDashboardCustomize}>
                  Custom Fields
                </Feature.Title>
                <WebTypo.P>
                  Extend Alinea with your own fields. Create custom inputs with
                  simple constructor functions. Tailored to exactly what your
                  editors need.
                </WebTypo.P>
                <WebTypo.Link href="/docs/fields/custom-fields">
                  Read more
                </WebTypo.Link>
              </WebTypo>
            </section>
          </VStack>
        </PageContainer>

        <PageContainer>
          <section className={styles.home.section()}>
            <div className={styles.home.demo()}>
              <iframe
                title="Alinea demo"
                src="https://demo.alineacms.com"
                className={styles.home.demo.inner()}
              />
            </div>
          </section>
        </PageContainer>*/}

        <PageContainer>
          <HStack justify="space-between" gap={`${px(16)} ${px(30)}`} wrap>
            <Highlight
              href="/docs/content/live-previews"
              icon={RiFlashlightFill}
            >
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

            <Highlight
              icon={PhGlobe}
              href="/docs/reference/internationalization"
            >
              Internationalization
            </Highlight>

            <Highlight icon={IcBaselineCloudQueue} href="/docs/deploy">
              Self-host or cloud host
            </Highlight>
          </HStack>
        </PageContainer>
      </main>
    </WebLayout>
  )
}

HomePage.sitemap = (): MetadataRoute.Sitemap => {
  return [{url: '/', priority: 1}]
}
