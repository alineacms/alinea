import {passwordLess} from '@alinea/auth.passwordless'
import {createCloudBackend} from '@alinea/cloud'
import {backend, createConfig, root, schema, workspace} from '@alinea/core'
import {LocaleSchema} from '@alinea/dashboard/schema/LocaleSchema'
import {MediaSchema} from '@alinea/dashboard/schema/MediaSchema'
import {BrowserPreview} from '@alinea/dashboard/view/preview/BrowserPreview'
import {IcRoundInsertDriveFile} from '@alinea/ui/icons/IcRoundInsertDriveFile'
import {IcRoundPermMedia} from '@alinea/ui/icons/IcRoundPermMedia'
import {configureBackend} from './alinea.server'
import {DocPageSchema} from './src/view/DocPage.schema'
import {DocsPageSchema} from './src/view/DocsPage.schema'
import {HomePageSchema} from './src/view/HomePage.schema'
import {LogoChar} from './src/view/layout/branding/LogoChar'

export const webSchema = schema({
  ...MediaSchema,
  Home: HomePageSchema,
  Docs: DocsPageSchema,
  Doc: DocPageSchema
})

const web = workspace('Alinea', {
  icon: LogoChar,
  schema: webSchema,
  typeNamespace: 'content',
  source: './content',
  mediaDir: './public',
  color: '#4a65e8',
  roots: {
    data: root('Alinea website', {
      icon: IcRoundInsertDriveFile,
      contains: ['Home', 'Docs']
    }),
    media: root('Media', {
      icon: IcRoundPermMedia,
      contains: ['MediaLibrary']
    })
  },
  preview({entry, previewToken}) {
    const noPreviews = new Set(['Docs', 'MediaLibrary'])
    if (noPreviews.has(entry.type)) return null
    const location =
      process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : ''
    return (
      <BrowserPreview
        // reload
        url={`${location}/api/preview?${previewToken}`}
        prettyUrl={entry.url}
      />
    )
  }
})

const stories = workspace('Stories', {
  schema: webSchema.concat(schema(LocaleSchema)),
  source: './content/stories',
  color: '#EF437C',
  roots: {
    data: root('Stories', {
      icon: IcRoundInsertDriveFile,
      contains: ['Home', 'Docs'],
      i18n: {
        locales: ['nl', 'fr']
      }
    })
  }
})

const workspaces = {web, stories}

const customBackend = backend({
  auth: passwordLess
}).configure(configureBackend)

const cloudBackend = createCloudBackend()

export const config = createConfig({
  dashboard: {
    dashboardUrl: 'https://alinea.sh/admin.html',
    handlerUrl: 'https://alinea.sh/api/cms',
    staticFile: './public/admin.html'
  },
  backend: cloudBackend,
  workspaces:
    process.env.NODE_ENV === 'development'
      ? workspaces
      : ({web} as typeof workspaces)
})
