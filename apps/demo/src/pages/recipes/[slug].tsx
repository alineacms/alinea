import {initPages} from '@alinea/content/demo/pages.js'
import {GetStaticPropsContext} from 'next'
import {DemoRecipedetail} from '../../view/channels/recipedetail/DemoRecipedetail'

export async function getStaticPaths(context: GetStaticPropsContext) {
  const pages = initPages(context.previewData as string)
  const paths = await pages
    .whereType('Recipedetail')
    .select((page: any) => page.path)

  return {
    paths: paths.map((slug: string) => ({params: {slug}})),
    fallback: true
  }
}

export async function getStaticProps(context: GetStaticPropsContext) {
  const pages = initPages(context.previewData as string)
  const slug = context.params && context.params.slug

  return {
    props: await pages
      .whereType('Recipedetail')
      .where((page: any) => page.path.is(slug))
      .first()
  }
}

export default DemoRecipedetail
