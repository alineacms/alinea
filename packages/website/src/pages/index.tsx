import {Page, pages} from '.alinea/web'
import {Entry} from '@alinea/core'
import {Pages} from '@alinea/server'
import {GetStaticPropsContext} from 'next'
import {server} from '../../alinea.server'
import {PageView} from '../view/PageView'

async function propsOf(pages: Pages<Page>, page: Page) {
  switch (page.type) {
    case 'Docs':
      return {
        ...page,
        children: await pages.all(
          pages.children(page.id).select({
            url: Entry.url,
            title: Entry.title
          })
        )
      }
    default:
      return page
  }
}

export async function getStaticProps(context: GetStaticPropsContext) {
  const from = context.preview
    ? pages.preview(server.drafts, context.previewData as string)
    : pages
  const paths = (context.params?.slug as Array<string>) || []
  const slug = '/' + paths.join('/')
  const page = await from.first(pages.byUrl(slug))
  if (!page) return {props: {}}
  return {props: await propsOf(from, page)}
}

type Unpack<T> = T extends Promise<infer X> ? X : T
export type PageProps = Unpack<ReturnType<typeof propsOf>>

export default PageView
