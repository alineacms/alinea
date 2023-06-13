import {Pages} from '@alinea/generated'
import {initPages} from '@alinea/generated/pages'
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

export type HomeProps = Awaited<ReturnType<typeof queryHome>>

export default DemoHome
