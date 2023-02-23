import {Pages} from 'alinea/content'
import {initPages} from 'alinea/content/pages'
import {GetStaticPropsContext} from 'next'
import {Recipe} from '../../view/recipe/Recipe'

export async function getStaticPaths(context: GetStaticPropsContext) {
  const pages = initPages(context.previewData as string)
  const paths = await pages.whereType('Recipe').select(page => page.path)
  return {
    paths: paths.map((slug: string) => ({params: {slug}})),
    fallback: true
  }
}

export async function getStaticProps(context: GetStaticPropsContext) {
  const pages = initPages(context.previewData as string)
  const slug = context.params && context.params.slug
  return {
    props: await queryRecipe(pages, slug as string)
  }
}

export async function queryRecipe(pages: Pages, slug: string) {
  const detail = await pages
    .whereType('Recipe')
    .where(page => page.path.is(slug))
    .sure()
  return {...detail, related: []}
}

export default Recipe
