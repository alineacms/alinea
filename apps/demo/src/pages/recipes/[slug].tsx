import {content} from '@alinea/content/demo'
import {initPages} from '@alinea/content/demo/pages.js'
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

export async function queryRecipe(pages: content.Pages, slug: string) {
  const detail = await pages
    .whereType('Recipe')
    .where(page => page.path.is(slug))
    .sure()
  const related = await pages
    .whereType('Recipe')
    .where(related => related.id.isNot(detail.id))
    .where(related => related.category.is(detail.category))
    .take(3)
  return {...detail, related}
}

export default Recipe
