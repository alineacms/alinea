import {content} from '@alinea/content/demo'
import {initPages} from '@alinea/content/demo/pages.js'
import {GetStaticPropsContext} from 'next'
import {DemoRecipes} from '../../view/channels/recipes/DemoRecipes'

export async function getStaticProps(context: GetStaticPropsContext) {
  const pages = initPages(context.previewData as string)
  return {props: await queryRecipes(pages)}
}

export async function queryRecipes(pages: content.Pages) {
  const parent = await pages.whereType('Recipes').sure()
  const children = await parent.tree.children()
  return {...parent, children}
}

export default DemoRecipes
