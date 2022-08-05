import {initPages} from '@alinea/content/demo/pages.js'
import {GetStaticPropsContext} from 'next'
import {DemoHome} from '../view/channels/home/DemoHome'

export async function getStaticProps(context: GetStaticPropsContext) {
  const pages = initPages(context.previewData as string)

  return {
    props: await pages.whereType('Home').first()
  }
}

export default DemoHome
