import type {MetaFunction} from '@remix-run/node'
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration
} from '@remix-run/react'

export const meta: MetaFunction = () => ({
  charset: 'utf-8',
  title: 'New Remix App',
  viewport: 'width=device-width,initial-scale=1'
})

// packages/preview/src/remix.ts
import {usePreview} from '@alinea/preview/react'
import {useRevalidator} from 'react-router-dom'

function useRemixPreview() {
  const revalidator = useRevalidator()
  return usePreview({
    async refetch() {
      revalidator.revalidate()
    }
  })
}

export default function App() {
  useRemixPreview()
  return (
    <html lang="en">
      <head>
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  )
}
