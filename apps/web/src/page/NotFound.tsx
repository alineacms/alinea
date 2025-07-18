import styler from '@alinea/styler'
import NextImage from 'next/image.js'
import heroBg from '@/assets/hero-alinea.jpg'
import {Hero} from '@/layout/Hero'
import {PageContainer, PageContent} from '@/layout/Page'
import WebLayout from '@/layout/WebLayout'
import css from './NotFound.module.scss'

const styles = styler(css)

export default async function NotFound() {
  const data = {
    title: 'Page Not Found',
    description: 'The page you were looking for does not exist.',
    button: {href: '/', title: 'Back to home'}
  }
  return (
    <WebLayout>
      <PageContainer>
        <PageContent>
          <main className={styles.notfound()}>
            <NextImage
              src={heroBg.src}
              alt="Background"
              fill
              priority
              placeholder="blur"
              blurDataURL={heroBg.blurDataURL}
              sizes="(max-width: 1440px) 100vw, 1280px"
              style={{objectFit: 'cover'}}
            />
            <div className={styles.notfound.content()}>
              <Hero.Title className={styles.notfound.content.title()}>
                {data.title}
              </Hero.Title>
              <Hero.ByLine>{data.description}</Hero.ByLine>
              {data.button?.href && (
                <Hero.Action href={data.button.href}>
                  {data.button.title}
                </Hero.Action>
              )}
            </div>
          </main>
        </PageContent>
      </PageContainer>
    </WebLayout>
  )
}
