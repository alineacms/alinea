import {createConfig, schema, workspace} from '@alinea/core'
import {BrowserPreview, MediaSchema} from '@alinea/dashboard'
import {MdInsertDriveFile, MdOutlinePermMedia} from 'react-icons/md/index.js'
import {DocPageSchema} from './src/view/DocPage.schema'
import {DocsPageSchema} from './src/view/DocsPage.schema'
import {HomePageSchema} from './src/view/HomePage.schema'

const webSchema = schema({
  ...MediaSchema,
  Home: HomePageSchema,
  Docs: DocsPageSchema,
  Doc: DocPageSchema
})

export const config = createConfig({
  dashboardUrl: 'http://localhost:4500',
  apiUrl: 'http://localhost:4500',
  workspaces: {
    web: workspace('Alinea', {
      schema: webSchema,
      contentDir: './content/web',
      mediaDir: './public',
      color: '#EF437C', // '#FFBD67',
      roots: {
        data: {
          icon: MdInsertDriveFile,
          contains: ['Home']
        },
        media: {
          icon: MdOutlinePermMedia,
          contains: ['MediaLibrary']
        }
      },
      preview({entry, previewToken}) {
        const noPreviews = new Set(['Docs', 'MediaLibrary'])
        if (noPreviews.has(entry.type)) return null
        return (
          <BrowserPreview
            url={`/api/preview?${previewToken}`}
            prettyUrl={entry.url}
          />
        )
      }
    }),
    stories: workspace('Stories', {
      schema: webSchema,
      contentDir: './content/stories',
      color: '#6E57D0',
      roots: {
        content: {
          icon: MdInsertDriveFile,
          contains: ['Home']
        }
      }
    })
  }
})
