import {initPages} from '@alinea/content/demo/pages.js'
import {GetStaticPropsContext} from 'next'

export async function getStaticProps(context: GetStaticPropsContext) {
  const pages = initPages(context.previewData as string)
  return {
    props: await pages.whereType('Home').first()
  }
}

export default function IndexPage(props) {
  return (
    <div>
      <h1>{props.title}</h1>
    </div>
  )
}
