import {initPages} from '@alinea/content/demo/pages.js'
import {GetStaticPropsContext} from 'next'
import {DemoHome} from '../view/channels/home/DemoHome'
import {DemoHomeSchema} from '../view/channels/home/DemoHome.schema'

export async function getStaticProps(context: GetStaticPropsContext) {
  const pages = initPages(context.previewData as string)
  return {
    props: await pages.whereType('Home').first()
  }
}

export default function IndexPage(props: DemoHomeSchema) {
  return <DemoHome {...props} />
}
