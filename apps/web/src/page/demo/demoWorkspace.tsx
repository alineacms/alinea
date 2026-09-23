import {Config} from 'alinea'
import {IcOutlinePersonOutline} from '@/icons'
import * as schema from '@/schema/demo'
import {demoLocales} from '@/schema/demo/DemoUrl'

/** The name of the fictional brand behind the demo site */
export const demoBrand = 'Oak & Loom'

function IcOutlineLooms() {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M5 3h2v18H5zm12 0h2v18h-2zM9 6h6v2H9zm0 5h6v2H9zm0 5h6v2H9z"
      />
    </svg>
  )
}

/**
 * The demo workspace, shared by the site's cms and the in-browser demo
 * dashboard so both stay in sync.
 */
export const demoWorkspace = Config.workspace(demoBrand, {
  color: '#9a6b3f',
  icon: IcOutlineLooms,
  source: 'content/demo',
  mediaDir: 'public/demo',
  mediaUrl: 'demo',
  roots: {
    pages: Config.root('Site', {
      i18n: {locales: demoLocales},
      contains: [
        schema.DemoHome,
        schema.DemoPage,
        schema.DemoProducts,
        schema.DemoCollections,
        schema.DemoJournal
      ]
    }),
    authors: Config.root('Authors', {
      icon: IcOutlinePersonOutline,
      contains: [schema.DemoAuthor]
    }),
    media: Config.media()
  }
})
