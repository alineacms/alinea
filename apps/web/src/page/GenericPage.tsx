import {Query} from 'alinea'
import type {Metadata, MetadataRoute, Viewport} from 'next'
import {notFound} from 'next/navigation'
import {cms} from '@/cms'
import {PageContainer, PageContent} from '@/layout/Page'
import WebLayout, {viewport as webViewport} from '@/layout/WebLayout'
import {Landing} from '@/schema/Landing'
import {Page} from '@/schema/Page'
import {getMetadata} from '@/utils/metadata'
import {TextFieldView} from './blocks/TextFieldView'
import {LandingPage} from './LandingPage'

export interface GenericPageProps {
  params: Promise<{
    slug: string
  }>
}

/** Top level pages are either a rich text Page or a Landing page */
const pageTypes = [Page, Landing]

export const dynamicParams = false
export async function generateStaticParams() {
  const paths = await cms.find({
    type: pageTypes,
    select: Query.path
  })
  return paths.map(slug => ({slug}))
}

export async function generateMetadata({
  params
}: GenericPageProps): Promise<Metadata> {
  const {slug} = await params
  const page = await cms.first({
    type: pageTypes,
    url: `/${slug}`,
    select: {
      url: Query.url,
      title: Page.title,
      metadata: Page.metadata
    }
  })
  if (!page) return await getMetadata(null)
  return await getMetadata(page)
}

export async function generateViewport({
  params
}: GenericPageProps): Promise<Viewport> {
  const {slug} = await params
  const theme = await cms.first({
    type: Landing,
    url: `/${slug}`,
    select: Landing.theme
  })
  if (theme === 'dark') return {themeColor: '#0d1030'}
  return webViewport
}

export default async function GenericPage({params}: GenericPageProps) {
  const {slug} = await params
  const url = `/${slug}`
  const landing = await cms.first({type: Landing, url})
  if (landing)
    return (
      <WebLayout theme={landing.theme} badge={landing.badge}>
        <LandingPage page={landing} />
      </WebLayout>
    )
  const page = await cms.first({type: Page, url})
  if (!page) return notFound()
  return (
    <WebLayout>
      <PageContainer>
        <PageContent>
          <article>
            <TextFieldView text={page.body} />
          </article>
        </PageContent>
      </PageContainer>
    </WebLayout>
  )
}

GenericPage.sitemap = async (): Promise<MetadataRoute.Sitemap> => {
  const pages = await generateStaticParams()
  return pages.map(page => ({url: `/${page.slug}`, priority: 0.5}))
}
