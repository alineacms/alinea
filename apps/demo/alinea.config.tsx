import {createConfig, root, schema, type, workspace} from '@alinea/core'
import {MediaSchema} from '@alinea/dashboard/schema/MediaSchema'
import {BrowserPreview} from '@alinea/dashboard/view/preview/BrowserPreview'
import {path} from '@alinea/input.path'
import {richText} from '@alinea/input.richtext'
import {text} from '@alinea/input.text'
import {IcRoundInsertDriveFile} from '@alinea/ui/icons/IcRoundInsertDriveFile'
import {IcRoundPermMedia} from '@alinea/ui/icons/IcRoundPermMedia'

const HomePageSchema = type('Home page', {
  title: text('Title'),
  path: path('Path'),
  content: richText('Content')
})

const demoSchema = schema({
  ...MediaSchema,
  Home: HomePageSchema
})

const demo = workspace('Demo', {
  schema: demoSchema,
  typeNamespace: 'content',
  source: './content',
  mediaDir: './public',
  color: 'yellow',
  roots: {
    data: root('Demo website', {
      icon: IcRoundInsertDriveFile,
      contains: ['Home', 'Docs']
    }),
    media: root('Media', {
      icon: IcRoundPermMedia,
      contains: ['MediaLibrary']
    })
  },
  preview({entry, previewToken}) {
    const location =
      process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : ''
    return (
      <BrowserPreview
        url={`${location}/api/preview?${previewToken}`}
        prettyUrl={entry.url}
      />
    )
  }
})

export const config = createConfig({
  workspaces: {demo}
})
