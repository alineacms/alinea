import {Entry} from '@alinea/core'
import {all, first, pages} from 'alinea/pages'
import {Page} from 'alinea/schema'
import {GetStaticPropsContext} from 'next'
import {PageView} from 'src/view/PageView'

function propsOf(page: Page) {
  switch (page.type) {
    case 'Docs':
      return {
        ...page,
        children: all(
          pages.children(page.id).select({
            $path: Entry.$path,
            title: Entry.title
          })
        )
      }
    default:
      return page
  }
}

export function getStaticProps(context: GetStaticPropsContext) {
  const paths = (context.params?.slug as Array<string>) || []
  const slug = '/' + paths.join('/')
  const page = first(pages.whereUrl(slug))
  if (!page) return {props: {}}
  return {
    props: propsOf(page)
  }
}

export type PageProps = ReturnType<typeof propsOf>

export default PageView
