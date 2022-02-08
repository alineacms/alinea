import {createConfig, schema, type, workspace} from '@alinea/core'
import {BrowserPreview, media} from '@alinea/dashboard'
import {link} from '@alinea/input.link'
import {list} from '@alinea/input.list'
import {path} from '@alinea/input.path'
import {richText} from '@alinea/input.richtext'
import {text} from '@alinea/input.text'
import {MdInsertDriveFile, MdOutlinePermMedia} from 'react-icons/md'

const webSchema = schema({
  ...media,
  Home: type(
    'Home',
    {
      title: text('Title', {multiline: true}),
      path: path('Path'),
      headline: text('Headline', {multiline: true}),
      byline: text('Byline', {multiline: true})
    },
    {isContainer: true}
  ),
  Docs: type(
    'Docs',
    {title: text('Title', {multiline: true}), path: path('Path')},
    {isContainer: true, contains: ['Doc']}
  ),
  Doc: type('Doc', {
    title: text('Title', {multiline: true}),
    path: path('Path'),
    body: richText('Body', {
      blocks: schema({
        CodeBlock: type('CodeBlock', {
          code: text('Code', {multiline: true})
        }),
        Inception: type('Inception', {
          wysiwyg: richText('Wysiwyg')
        })
      })
    }),
    blocks: list('List test', {
      schema: schema({
        A: type('Type A', {
          field1: text('Field 1')
        }),
        Wysiwyg: type('Wysiwyg', {
          field1: richText('Field 2')
        }),
        Image: type('Image', {
          image: link('Link')
        })
      })
    })
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
        if (entry.type === 'MediaLibrary') return null
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
