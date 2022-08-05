import {initPages} from '@alinea/content/demo/pages.js'
import {GetStaticPropsContext} from 'next'
import {DemoRecipes} from '../../view/channels/recipes/DemoRecipes'

export async function getStaticProps(context: GetStaticPropsContext) {
  const pages = initPages(context.previewData as string)
  const parent = await pages.whereType('Recipes').first()
  const children = await parent.tree.children()

  return {props: {...parent, children}}
}

export default DemoRecipes
