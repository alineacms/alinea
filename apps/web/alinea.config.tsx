import {createCloudBackend} from 'alinea/cloud'
import {createConfig, root, schema, workspace} from 'alinea/core'
import {MediaSchema} from 'alinea/dashboard/schema'
import {BrowserPreview} from 'alinea/dashboard/view/preview/BrowserPreview'
import {IcRoundInsertDriveFile} from 'alinea/ui/icons/IcRoundInsertDriveFile'
import {IcRoundPermMedia} from 'alinea/ui/icons/IcRoundPermMedia'
import {BlogOverviewSchema} from './src/view/BlogOverview.schema'
//import {configureBackend} from './alinea.server'
import {BlogPostSchema} from './src/view/BlogPost.schema'
import {DocPageSchema} from './src/view/DocPage.schema'
import {DocsPageSchema} from './src/view/DocsPage.schema'
import {HomePageSchema} from './src/view/HomePage.schema'
import {LogoChar} from './src/view/layout/branding/LogoChar'
import {PageSchema} from './src/view/Page.schema'

const webSchema = schema({
  ...MediaSchema,
  Home: HomePageSchema,
  Docs: DocsPageSchema,
  Doc: DocPageSchema,
  Page: PageSchema,
  BlogOverview: BlogOverviewSchema,
  BlogPost: BlogPostSchema
})

const web = workspace('Alinea', {
  icon: LogoChar,
  source: './content',
  mediaDir: './public',
  // mediaUrl: (location: string) => location.slice('public'.length),
  color: '#4a65e8',
  roots: {
    data: root('Alinea website', {
      icon: IcRoundInsertDriveFile,
      contains: ['Page', 'BlogOverview', 'Home', 'Docs']
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

const cloudBackend = createCloudBackend()

export const config = createConfig({
  schema: webSchema,
  dashboard: {
    dashboardUrl: '/admin.html',
    handlerUrl: '/api/cms',
    staticFile: './public/admin.html'
  },
  backend: cloudBackend,
  workspaces:
    process.env.NODE_ENV === 'development'
      ? workspaces
      : ({web} as typeof workspaces)
})
