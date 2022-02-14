import {createConfig, schema, type, workspace} from '@alinea/core'
import {BrowserPreview, media} from '@alinea/dashboard'
import {code} from '@alinea/input.code'
import {list} from '@alinea/input.list'
import {path} from '@alinea/input.path'
import {richText} from '@alinea/input.richtext'
import {tabs} from '@alinea/input.tabs'
import {text} from '@alinea/input.text'
import {MdInsertDriveFile, MdOutlinePermMedia} from 'react-icons/md/index.js'

const body = list('List test', {
  schema: schema({
    Text: type('Text', {
      text: richText('Text')
    }),
    Example: type(
      'Example',
      tabs(
        type('Visual code', {
          visual: code('Code sample')
        }),
        type('Example code', {
          code: code('Code')
        })
      )
    )
  })
})

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
    body
  })
})

/*
<Type key="doc" name="Doc">
  <Text key="title" name="Title" width={0.5} />
  <Path key="path" name="path" width={0.5} />
  <RichText key="body" name="Body">
    <Tabs>
      <Tab name="Visual code">
        <Code key="code" />
      </Tab>
    </Tabs>
  </RichText>
</Type>
*/

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
