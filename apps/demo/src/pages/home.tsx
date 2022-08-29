import {content} from '@alinea/content/demo'
import {initPages} from '@alinea/content/demo/pages.js'
import {GetStaticPropsContext} from 'next'
import {DemoHome} from '../view/channels/home/DemoHome'

export async function getStaticProps(context: GetStaticPropsContext) {
  const pages = initPages(context.previewData as string)
  return {
    props: await queryHome(pages)
  }
}

export function queryHome(pages: content.Pages) {
  return pages.whereType('Home').sure()
}

export default DemoHome
