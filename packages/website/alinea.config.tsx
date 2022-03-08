import {createConfig, schema, type, workspace} from '@alinea/core'
import {MediaSchema} from '@alinea/dashboard/schema/MediaSchema.js'
import {BrowserPreview} from '@alinea/dashboard/view/preview/BrowserPreview.js'
import {text} from '@alinea/input.text'
import {
  MdBookmarkBorder,
  MdInsertDriveFile,
  MdOutlinePermMedia
} from 'react-icons/md/index.js'
import {DocPageSchema} from './src/view/DocPage.schema'
import {DocsPageSchema} from './src/view/DocsPage.schema'
import {HomePageSchema} from './src/view/HomePage.schema'

const webSchema = schema({
  ...MediaSchema,
  Home: HomePageSchema,
  Docs: DocsPageSchema,
  Doc: DocPageSchema
})

const storiesSchema = schema({
  StoryDir: type('StoryDir', {
    title: text('Title')
  }).configure({isContainer: true, contains: ['StoryDir', 'Story']}),
  Story: type('Story', {
    title: text('Title')
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
      color: '#6E57D0', // '#EF437C', // '#FFBD67',
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
    // The plan here is: if we can pass a custom Data.Source, we can easily
    // generate a story and type for each *.story.tsx for example. However
    // we want this configuration to only be available server side which
    // complicates this a lot. We can either
    // - be declarative instead of importing implementation
    //    (source: {dir: ...}, source: {entryPoint: 'generatestories.ts'})
    // - make sure the Source we use is removed for clients with export maps
    // - create a separate file to configurate sources
    // - move source config to alinea.server.ts
    // - tweak AST to remove source while compiling config.js
    // So far none of these sound appealing... In a perfect world we'd be able
    // to use the same principle for fetching data from other external sources.
    stories: workspace('Stories', {
      schema: storiesSchema, //
      contentDir: './content/stories',
      color: '#6E57D0',
      roots: {
        data: {
          icon: MdBookmarkBorder,
          contains: ['StoryDir', 'Story']
        }
      }
      /*
      const stories: Record<string, () => Promise<any>> = {
        FileUploader: () => import('../dashboard/src/view/media/FileUploader.story')
      }
      const storyCache = new Map()
      preview({entry}) {
        const story = entry.title as string
        const importer = stories[story]
        if (!importer) return null
        if (!storyCache.has(story)) {
          storyCache.set(
            story,
            lazy(() =>
              importer().then(m => ({default: m[story] || m[`${story}Story`]}))
            )
          )
        }
        const Story = storyCache.get(story)
        return <Story />
      }
      */
    })
  }
})
