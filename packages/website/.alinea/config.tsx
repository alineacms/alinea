import {createConfig, workspace} from '@alinea/core'
import {BrowserPreview} from '@alinea/dashboard/view/preview/BrowserPreview.js'
import {
  MdBookmarkBorder,
  MdInsertDriveFile,
  MdOutlinePermMedia
} from 'react-icons/md/index.js'
import {storiesSchema} from './stories/schema'
import {webSchema} from './web/schema'

export const config = createConfig({
  workspaces: {
    web: workspace('Alinea', {
      schema: webSchema,
      source: './web/content',
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
      schema: storiesSchema, //
      source: './stories/source',
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
