import {createConfig, schema, workspace} from '@alineacms/core'
import {MediaSchema} from '@alineacms/dashboard/schema/MediaSchema.js'
import {BrowserPreview} from '@alineacms/dashboard/view/preview/BrowserPreview.js'
import {MdInsertDriveFile, MdOutlinePermMedia} from 'react-icons/md/index.js'
import {DocPageSchema} from './src/view/DocPage.schema'
import {DocsPageSchema} from './src/view/DocsPage.schema'
import {HomePageSchema} from './src/view/HomePage.schema'

export const webSchema = schema({
  ...MediaSchema,
  Home: HomePageSchema,
  Docs: DocsPageSchema,
  Doc: DocPageSchema
})

export const config = createConfig({
  workspaces: {
    web: workspace('Alinea', {
      schema: webSchema,
      source: './content',
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
    })
  }
})
