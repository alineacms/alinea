import {
  createConfig,
  MediaSchema,
  path,
  root,
  schema,
  text,
  type,
  Welcome,
  workspace
} from 'alinea'
import {MdInsertDriveFile, MdOutlinePermMedia} from 'react-icons/md'

export const config = createConfig({
  workspaces: {
    main: workspace('Example', {
      source: './content',
      schema: schema({
        ...MediaSchema,
        Page: type(
          'Page',
          {
            title: text('Title'),
            path: path('Path')
          },
          <Welcome />
        ).configure({isContainer: true})
      }),
      roots: {
        data: root('Example project', {
          icon: MdInsertDriveFile,
          contains: ['Home']
        }),
        media: root('Media', {
          icon: MdOutlinePermMedia,
          contains: ['MediaLibrary']
        })
      }
    })
  }
})
