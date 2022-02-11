import {createConfig, schema, type, workspace} from '@alinea/core'
import {BrowserPreview, media} from '@alinea/dashboard'
import {link} from '@alinea/input.link'
import {list} from '@alinea/input.list'
import {path} from '@alinea/input.path'
import {richText} from '@alinea/input.richtext'
import {text} from '@alinea/input.text'
import {MdInsertDriveFile, MdOutlinePermMedia} from 'react-icons/md/index.js'

const blocks = list('List test', {
  schema: schema({
    A: type('Type A', {
      field1: text('Field 1'),
      field2: text('Field 2', {width: 0.5}),
      field3: text('Field 3', {
        width: 0.5
      })
    }),
    Wysiwyg: type('Wysiwyg', {
      field1: richText('Field 2')
    }),
    Image: type('Image', {
      image: link('Link')
    }),
    Depth: type('List again', {
      items: list('Items', {
        schema: schema({
          A: type('Type A', {
            field1: text('Field 1'),
            field2: text('Field 2', {width: 0.5}),
            field3: text('Field 3', {width: 0.5})
          }),
          Wysiwyg: type('Wysiwyg', {
            field1: richText('Field 2')
          })
        })
      })
    })
  })
})

const webSchema = schema({
  ...media,
  Home: type(
    'Home',
    {
      title: text('Title', {
        width: 0.5,
        multiline: true
      }),
      path: path('Path', {width: 0.5}),
      headline: text('Headline', {multiline: true}),
      byline: text('Byline', {multiline: true})
    },
    {isContainer: true}
  ),
  Docs: type(
    'Docs',
    {
      title: text('Title', {width: 0.5, multiline: true}),
      path: path('Path', {width: 0.5})
    },
    {isContainer: true, contains: ['Doc']}
  ),
  Doc: type('Doc', {
    title: text('Title', {width: 0.5}),
    path: path('Path', {width: 0.5}),
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
    blocks
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
      color: '#6E57D0', //'#FFBD67',
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
