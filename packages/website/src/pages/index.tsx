import {alinea, Page} from '.alinea'
import {Entry} from '@alinea/core'
import {GetStaticPropsContext} from 'next'
import {PageView} from '../view/PageView'

async function propsOf(page: Page) {
  const pages = await alinea.pages
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
  const pages = await alinea.pages
  const paths = (context.params?.slug as Array<string>) || []
  const slug = '/' + paths.join('/')
  const page = pages.first(pages.whereUrl(slug))
  if (!page) return {props: {}}
  return {
    props: await propsOf(page)
  }
}

type Unpack<T> = T extends Promise<infer X> ? X : T
export type PageProps = Unpack<ReturnType<typeof propsOf>>

export default PageView
