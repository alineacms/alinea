import {Page} from 'alinea/content'
import {initPages} from 'alinea/content/pages'
import {RichText} from 'alinea/ui'
import {json, LoaderArgs} from '@remix-run/node'
import {useLoaderData} from '@remix-run/react'

export async function loader({request}: LoaderArgs) {
  const previewToken = request.url.slice(request.url.indexOf('?') + 1)
  const pages = initPages(previewToken)
  return json(await pages.whereType('Welcome').first())
}

export default function Index() {
  const data = useLoaderData<Page.Welcome>()
  return (
    <div style={{fontFamily: 'system-ui, sans-serif', lineHeight: '1.4'}}>
      <h1>{data.title}</h1>
      <RichText doc={data.body} />
    </div>
  )
}
