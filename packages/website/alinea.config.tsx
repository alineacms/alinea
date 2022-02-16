import {createConfig, schema, type, workspace} from '@alinea/core'
import {BrowserPreview, media} from '@alinea/dashboard'
import {path} from '@alinea/input.path'
import {text} from '@alinea/input.text'
import {MdInsertDriveFile, MdOutlinePermMedia} from 'react-icons/md/index.js'
import {Blocks} from './src/view/blocks/Blocks'

const webSchema = schema({
  ...media,
  Home: type('Home', {
    title: text('Title', {
      width: 0.5,
      multiline: true
    }),
    path: path('Path', {width: 0.5}),
    headline: text('Headline', {multiline: true}),
    byline: text('Byline', {multiline: true})
  }).configure({isContainer: true}),
  Docs: type('Docs', {
    title: text('Title', {width: 0.5, multiline: true}),
    path: path('Path', {width: 0.5})
  }).configure({isContainer: true, contains: ['Doc', 'Docs']}),
  Doc: type('Doc', {
    title: text('Title', {width: 0.5}),
    path: path('Path', {width: 0.5}),
    blocks: Blocks
  })
})

export const config = createConfig({
  dashboardUrl: 'http://localhost:4500',
  apiUrl: 'http://localhost:4500',
  workspaces: {
    web: workspace('Alinea', {
      schema: webSchema,
      contentDir: './content/web',
      mediaDir: './public',
      color: '#FFBD67',
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
      preview(entry) {
        const noPreviews = new Set(['Docs', 'MediaLibrary'])
        if (noPreviews.has(entry.type)) return null
        return <BrowserPreview url={`/api/preview?${entry.url}`} />
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
