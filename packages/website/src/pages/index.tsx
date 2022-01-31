import {alinea, Page} from '.alinea'
import {Entry} from '@alinea/core'
import {Pages} from '@alinea/server'
import {GetStaticPropsContext} from 'next'
import {drafts} from 'src/config.server'
import {PageView} from '../view/PageView'

function propsOf(pages: Pages<Page>, page: Page) {
  switch (page.type) {
    case 'Docs':
      return {
        ...page,
        children: pages.all(
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
  let pages = await alinea.pages
  if (context.preview) pages = await pages.preview(drafts)
  const paths = (context.params?.slug as Array<string>) || []
  const slug = '/' + paths.join('/')
  const page = pages.first(pages.whereUrl(slug))
  if (!page) return {props: {}}
  return {props: propsOf(pages, page)}
}

type Unpack<T> = T extends Promise<infer X> ? X : T
export type PageProps = Unpack<ReturnType<typeof propsOf>>

export default PageView
