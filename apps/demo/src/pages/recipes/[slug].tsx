import {initPages} from '@alinea/content/demo/pages.js'
import {GetStaticPropsContext} from 'next'
import {DemoRecipedetail} from '../../view/channels/recipedetail/DemoRecipedetail'
import {DemoRecipedetailSchema} from '../../view/channels/recipedetail/DemoRecipedetail.schema'

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
  const currentProps: DemoRecipedetailSchema = await pages
    .whereType('Recipedetail')
    .where((page: DemoRecipedetailSchema) => page.path.is(slug))
    .first()

  const related: DemoRecipedetailSchema[] = await pages
    .whereType('Recipedetail')
    .where((related: DemoRecipedetailSchema) =>
      related?.id.isNot(currentProps?.id)
    )
    .where(
      (related: DemoRecipedetailSchema) =>
        related?.category && related.category.is(currentProps?.category)
    )
    .take(3)

  return {
    props: {...currentProps, related}
  }
}

export default DemoRecipedetail
