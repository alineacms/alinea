import {initPages} from '@alinea/content/demo/pages.js'
import {GetStaticPropsContext} from 'next'
import {DemoRecipedetail} from '../../view/channels/recipedetail/DemoRecipedetail'

export async function getStaticPaths(context: GetStaticPropsContext) {
  const pages = initPages(context.previewData as string)
  const paths = await pages.whereType('Recipedetail').select(page => page.path)
  return {
    paths: paths.map((slug: string) => ({params: {slug}})),
    fallback: true
  }
}

export async function getStaticProps(context: GetStaticPropsContext) {
  const pages = initPages(context.previewData as string)
  const slug = context.params && context.params.slug
  const detail = await pages
    .whereType('Recipedetail')
    .where(page => page.path.is(slug as string))
    .sure()
  const related = await pages
    .whereType('Recipedetail')
    .where(related => related.id.isNot(detail.id))
    .where(related => related.category.is(detail.category))
    .take(3)
  return {
    props: {...detail, related}
  }
}

export default DemoRecipedetail
