import {Pages} from '@alinea/content'
import {initPages} from '@alinea/content/pages'
import {Store} from '@alinea/store'
import {GetStaticPropsContext} from 'next'
import {DemoHome} from '../view/home/DemoHome'

export async function getStaticProps(context: GetStaticPropsContext) {
  const pages = initPages(context.previewData as string)
  return {
    props: await queryHome(pages)
  }
}

export async function queryHome(pages: Pages) {
  const home = await pages.whereType('Home').sure()
  const recipes = await pages
    .whereType('Recipe')
    .select(page => ({
      id: page.id,
      title: page.title,
      url: page.url,
      header: page.header,
      intro: page.intro
    }))
    .take(10)
  return {...home, recipes}
}

export type HomeProps = Store.TypeOf<ReturnType<typeof queryHome>>

export default DemoHome
