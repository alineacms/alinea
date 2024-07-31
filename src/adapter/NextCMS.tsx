import {Request} from '@alinea/iso'
import {Database} from 'alinea/backend/Database'
import {generatedStore} from 'alinea/backend/Store'
import {JWTPreviews} from 'alinea/backend/util/JWTPreviews'
import {Client} from 'alinea/core/Client'
import {CMS, ConnectionContext} from 'alinea/core/CMS'
import {Config} from 'alinea/core/Config'
import {Entry} from 'alinea/core/Entry'
import {outcome} from 'alinea/core/Outcome'
import {createSelection} from 'alinea/core/pages/CreateSelection'
import {Logger} from 'alinea/core/util/Logger'
import {createCloudHandler} from '../cloud/server/CloudHandler.js'
import {parseChunkedCookies} from '../preview/ChunkCookieValue.js'
import {alineaCookies} from './AlineaCookies.js'

export interface PreviewProps {
  widget?: boolean
  workspace?: string
  root?: string
}

export class NextCMS<
  Definition extends Config = Config
> extends CMS<Definition> {
  async getContext() {
    const apiKey = process.env.ALINEA_API_KEY
    const context: ConnectionContext = {apiKey}
    const {cookies, draftMode} = await import('next/headers.js')
    const [isDraft] = outcome(() => draftMode().isEnabled)
    if (!isDraft) return context
    const cookie = cookies()
    const previewToken = cookie.get(alineaCookies.previewToken)?.value
    if (previewToken) {
      const update = parseChunkedCookies(alineaCookies.update, cookie.getAll())
      const previews = new JWTPreviews(context.apiKey ?? 'dev')
      const info = await previews.verify(previewToken)
      context.preview = {...info, update}
    }
    return context
  }

  async handlePreview(request: Request): Promise<Response> {
    const {draftMode, cookies} = await import('next/headers.js')
    const context = await this.getContext()
    const {searchParams} = new URL(request.url)
    const previewToken = searchParams.get('preview')
    if (!previewToken) return new Response('Not found', {status: 404})
    const previews = new JWTPreviews(context.apiKey ?? 'dev')
    const info = await previews.verify(previewToken)
    const cookie = cookies()
    cookie.set(alineaCookies.previewToken, previewToken)
    const cnx = await this.connection
    const url = (await cnx.resolve({
      preview: context.preview,
      selection: createSelection(
        Entry({entryId: info.entryId}).select(Entry.url).first()
      )
    })) as string | null
    if (!url) return new Response('Not found', {status: 404})
    const source = new URL(request.url)
    // Next.js incorrectly reports 0.0.0.0 as the hostname if the server is
    // listening on all interfaces
    if (source.hostname === '0.0.0.0') source.hostname = 'localhost'
    const location = new URL(url, source.origin)
    draftMode().enable()
    return new Response(`Redirecting...`, {
      status: 302,
      headers: {location: String(location)}
    })
  }

  previews = async ({widget, workspace, root}: PreviewProps) => {
    const {draftMode} = await import('next/headers.js')
    const {default: dynamic} = await import('next/dynamic.js')
    const [isDraft] = outcome(() => draftMode().isEnabled)
    if (!isDraft) return null
    const dashboardUrl = this.config.dashboard?.dashboardUrl ?? '/admin.html'
    const NextPreviews = dynamic(() => import('./NextPreviews.js'), {
      ssr: false
    })
    return (
      <NextPreviews
        dashboardUrl={dashboardUrl}
        widget={widget}
        workspace={workspace}
        root={root}
      />
    )
  }
}

function isBuild() {
  const argv = process.argv
  for (const i of argv.keys()) {
    if (argv[i] === 'next' && argv[i + 1] === 'build') return true
  }
  return false
}

export function createCMS<Definition extends Config>(config: Definition) {
  const devUrl = process.env.ALINEA_DEV_SERVER
  return new NextCMS<Definition>(
    config,
    isBuild()
      ? generatedStore.then(store =>
          createCloudHandler(
            config,
            new Database(config, store),
            devUrl
          ).connect({
            logger: new Logger('build')
          })
        )
      : Promise.resolve(new Client({url: devUrl ?? '/api/cms'}))
  )
}
