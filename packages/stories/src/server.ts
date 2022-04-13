import {serve} from '@alinea/cli/Serve.js'
// We import the global styles here so they're included in the bundle.
// In the Next.js build these are imported in the _app view.
import '@alinea/css/global.css'
import {SassPlugin} from '@esbx/sass'
import autoprefixer from 'autoprefixer'
import dotenv from 'dotenv'
import path from 'node:path'
import pxToRem from 'postcss-pxtorem'
import {createElement} from 'react'
import ReactDOMServer from 'react-dom/server.js'
import PageView from '../../website/src/pages'
import {pageViewQuery} from '../../website/src/view/PageView.query'

dotenv.config({path: '../../.env'})

serve({
  cwd: path.resolve('../../packages/website'),
  port: 4500,
  buildOptions: {
    plugins: [
      SassPlugin.configure({
        postCssPlugins: [
          pxToRem({
            propList: ['*'],
            minPixelValue: 2
          }),
          autoprefixer()
        ],
        moduleOptions: {
          localsConvention: 'dashes',
          generateScopedName: 'alinea__[name]-[local]'
        }
      })
    ]
  },
  previewHandler(server) {
    return async (req, res) => {
      try {
        const previewToken = decodeURIComponent(
          new URL(req.url!, 'http://localhost').search
        ).substring(1)
        res.startTime('token', 'Parse preview token')
        const {id, url} = await server.parsePreviewToken(previewToken)
        res.endTime('token')
        res.startTime('page', 'Fetch page props')
        const props = await pageViewQuery(
          server.loadPages('web', previewToken) as any,
          url
        )
        res.endTime('page')
        res.startTime('render', 'React render time')
        const html = ReactDOMServer.renderToStaticMarkup(
          createElement(PageView, props)
        )
        res.endTime('render')
        return res.header('content-type', 'text/html').end(
          `<!doctype html>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <link href="/dist/server.css" rel="stylesheet" />
          ${html}`
        )
      } catch (e: any) {
        return res.status(500).end(`${e.stack || e.message}`)
      }
    }
  }
})
