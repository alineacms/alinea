import {initPages} from '@alinea/content/main/pages.js'
import {json, LoaderArgs} from '@remix-run/node'
import {useLoaderData} from '@remix-run/react'

export async function loader({request}: LoaderArgs) {
  const previewToken = request.url.slice(request.url.indexOf('?') + 1)
  const pages = initPages(previewToken)
  return json(await pages.first())
}

export default function Index() {
  const data = useLoaderData()
  return (
    <div style={{fontFamily: 'system-ui, sans-serif', lineHeight: '1.4'}}>
      <h1>{data.title}</h1>
      <ul>
        <li>
          <a
            target="_blank"
            href="https://remix.run/tutorials/blog"
            rel="noreferrer"
          >
            15m Quickstart Blog Tutorial
          </a>
        </li>
        <li>
          <a
            target="_blank"
            href="https://remix.run/tutorials/jokes"
            rel="noreferrer"
          >
            Deep Dive Jokes App Tutorial
          </a>
        </li>
        <li>
          <a target="_blank" href="https://remix.run/docs" rel="noreferrer">
            Remix Docs
          </a>
        </li>
      </ul>
    </div>
  )
}
