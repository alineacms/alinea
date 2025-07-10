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
import type {ComponentType, PropsWithChildren, SVGProps} from 'react'
import heroBg from '@/assets/hero-alinea.jpg'
import screenshot from '@/assets/screenshot.png'
import screenshot2 from '@/assets/screenshot2.png'
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
import {CodeBlockView} from './blocks/CodeBlockView'
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
    },
    alternates: {canonical: '/'}
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

const schemaExample = `
// Configure a CMS within minutes

const BlogPost = Config.document('Blog post', {
  fields: {
    title: Field.text('Title'),
    body: Field.richText('Body text')
  }
})

const Blog = Config.document('Blog', {
  contains: [BlogPost]
})

const cms = createCMS({schema: {Blog, BlogPost}})
`

const queryExample = `
// Query content within React components

const blog = await cms.get({
  type: Blog
})

const posts = await cms.find({
  type: BlogPost,
  select: {title: BlogPost.title, body: BlogPost.body}
  // ... filter, sort, paginate, order by, etc.
})
`

export default async function HomePage() {
  const home = await cms.get({type: Home})
  return (
    <WebLayout>
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
          <div className={styles.home.sections()}>
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

            <section className={styles.home.section()}>
              <WebTypo>
                <WebTypo.H2>
                  Organize content in a clear,{'\n'}hierarchical structure
                </WebTypo.H2>
                <WebTypo.P>
                  Editors can easily navigate, reorder, and manage pages in a
                  way that makes sense for any project. Navigation stays simple,
                  whether you’re editing in the dashboard or working with the
                  API.
                </WebTypo.P>
              </WebTypo>

              <div className={styles.home.section.illustration()}>
                <Image
                  alt="Alinea dashboard screenshot"
                  {...screenshot2}
                  sizes="50vw"
                  className={styles.home.section.screenshot()}
                />
              </div>
            </section>

            <section className={styles.home.section()}>
              <div className={styles.home.section.illustration()}>
                <CodeBlockView
                  code={schemaExample.trim()}
                  fileName=""
                  language="tsx"
                  compact={false}
                />
              </div>

              <WebTypo>
                <WebTypo.H2>
                  Describe your schema in code,{'\n'}
                  get back fully typed content
                </WebTypo.H2>
                <WebTypo.P>
                  Define your content schema in code and get fully typed content
                  instantly — no generation step needed. Skip the endless form
                  clicks and manage structure with the same workflow: branch,
                  test, and iterate in code.
                </WebTypo.P>
              </WebTypo>
            </section>

            <section className={styles.home.section()}>
              <WebTypo>
                <WebTypo.H2>Publish with control</WebTypo.H2>
                <WebTypo.P>
                  Work on content without publishing right away. Alinea makes it
                  easy to manage drafts, archive old pages, and keep your
                  workspace tidy. The workflow stays simple for everyday tasks,
                  but gives you the structure and control needed for larger,
                  more complex projects.
                </WebTypo.P>
              </WebTypo>

              <div className={styles.home.section.illustration()}>
                <Image
                  alt="Alinea content tree screenshot"
                  {...screenshot}
                  sizes="50vw"
                  className={styles.home.section.screenshot()}
                />
              </div>
            </section>

            <section className={styles.home.section()}>
              <div className={styles.home.section.illustration()}>
                <CodeBlockView
                  code={queryExample.trim()}
                  fileName=""
                  language="tsx"
                  compact={false}
                />
              </div>

              <WebTypo>
                <WebTypo.H2>
                  Content is local, versioned,{'\n'}and deploys with your site
                </WebTypo.H2>
                <WebTypo.P>
                  Access content through a developer-friendly query API. Because
                  everything is bundled at build time, there is no need for
                  runtime fetching or external requests.
                </WebTypo.P>
              </WebTypo>
            </section>

            <Features>
              <Feature>
                <WebTypo>
                  <Feature.Title icon={ProiconsOpenSource}>
                    Open source
                  </Feature.Title>
                  <WebTypo.P>
                    Open source by design, Alinea gives you full control over
                    your CMS. Use it, extend it, or contribute back.
                  </WebTypo.P>
                </WebTypo>
              </Feature>

              <Feature>
                <WebTypo>
                  <Feature.Title icon={RiFlashlightFill}>
                    Live Previews
                  </Feature.Title>
                  <WebTypo.P>
                    See exactly what content changes look like in real time.
                    Preview updates instantly with full support for React Server
                    Components.
                  </WebTypo.P>
                </WebTypo>
              </Feature>

              <Feature>
                <WebTypo>
                  <Feature.Title icon={IcBaselineDashboardCustomize}>
                    Custom Fields
                  </Feature.Title>
                  <WebTypo.P>
                    Extend Alinea with your own fields. Create custom inputs
                    with simple constructor functions. Tailored to exactly what
                    your editors need.
                  </WebTypo.P>
                </WebTypo>
              </Feature>
            </Features>
          </div>
        </PageContainer>

        {/*<PageContainer>
          <section className={styles.home.section()}>
            <div className={styles.home.demo()}>
              <iframe
                title="Alinea demo"
                src="https://alineacms.com/demo"
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

export function ProiconsOpenSource(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      {...props}
    >
      {/* Icon from ProIcons by ProCode - https://github.com/ProCode-Software/proicons/blob/main/LICENSE */}
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M15.157 20.136c.211.51.8.757 1.284.492a9.25 9.25 0 1 0-8.882 0c.484.265 1.073.018 1.284-.492l1.358-3.28c.212-.51-.043-1.086-.478-1.426a3.7 3.7 0 1 1 4.554 0c-.435.34-.69.916-.478 1.426z"
      />
    </svg>
  )
}
