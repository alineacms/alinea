import styler from '@alinea/styler'
import type {Link as AnyLink} from 'alinea'
import {Query} from 'alinea'
import {Icon} from 'alinea/ui/Icon'
import {IcRoundOpenInNew} from 'alinea/ui/icons/IcRoundOpenInNew'
import {HStack, VStack} from 'alinea/ui/Stack'
import {px} from 'alinea/ui/util/Units'
import type {Metadata, MetadataRoute} from 'next'
import NextImage from 'next/image.js'
import heroBg from '@/assets/hero-alinea.jpg'
import programBadge from '@/assets/program-badge.svg'
import {cms} from '@/cms'
import {Hero} from '@/layout/Hero'
import {PageContainer} from '@/layout/Page'
import WebLayout from '@/layout/WebLayout'
import {WebText} from '@/layout/WebText'
import {WebTypo} from '@/layout/WebTypo'
import {FeaturesBlockView} from '@/page/blocks/FeaturesBlockView'
import {ImageTextBlockView} from '@/page/blocks/ImageTextBlockView'
import {QuickLinksBlockView} from '@/page/blocks/QuickLinksBlockView'
import {TemplateBlockView} from '@/page/blocks/TemplateBlock'
import {Home} from '@/schema/Home'
import {getMetadata} from '@/utils/metadata'
import {CodeTextBlockView} from './blocks/CodeTextBlockView'
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

function isUrlLink(link: AnyLink<{label: string}>) {
  return link._type === 'url'
}

type HomeHeroProps = {
  headline: string
  byline: string
  button?: AnyLink<{label: string}>
  link?: AnyLink<{label: string}>
}
function HomeHero({headline, byline, button, link}: HomeHeroProps) {
  return (
    <div className={styles.hero()}>
      <PageContainer>
        <div className={styles.hero.block()}>
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
            <a
              href="https://vercel.com/oss"
              target="_blank"
              rel="noopener"
              className={styles.hero.vercel()}
            >
              <img alt="Vercel OSS Program" src={programBadge.src} />
            </a>
            {headline && <Hero.Title>{headline}</Hero.Title>}
            {byline && <Hero.ByLine>{byline}</Hero.ByLine>}
            {(button?.href || link?.href) && (
              <HStack
                wrap
                gap={`${px(16)} ${px(24)}`}
                center
                style={{paddingTop: px(20)}}
                justify="center"
              >
                {button?.href && (
                  <Hero.Action {...button}>
                    {button.fields.label || button.title}
                  </Hero.Action>
                )}
                {link?.href && (
                  <WebTypo.Link
                    href={link.href}
                    target={isUrlLink(link) ? link.target : undefined}
                    className={styles.hero.demo()}
                  >
                    <HStack gap={8} center>
                      <span>Try a demo</span>
                      {isUrlLink(link) && link.target === '_blank' && (
                        <Icon icon={IcRoundOpenInNew} />
                      )}
                    </HStack>
                  </WebTypo.Link>
                )}
              </HStack>
            )}
          </VStack>
        </div>
      </PageContainer>
    </div>
  )
}

export default async function HomePage() {
  const home = await cms.get({type: Home})

  return (
    <WebLayout>
      <main className={styles.home()}>
        <HomeHero {...home?.hero} />
        <PageContainer>
          <div className={styles.home.sections()}>
            <WebText
              doc={home.body}
              CodeTextBlock={CodeTextBlockView}
              FeaturesBlock={FeaturesBlockView}
              ImageTextBlock={ImageTextBlockView}
              TemplateBlock={TemplateBlockView}
              QuickLinksBlock={QuickLinksBlockView}
            />
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
      </main>
    </WebLayout>
  )
}

HomePage.sitemap = (): MetadataRoute.Sitemap => {
  return [{url: '/', priority: 1}]
}
