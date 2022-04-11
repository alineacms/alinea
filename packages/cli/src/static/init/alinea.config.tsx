import {createConfig, MediaSchema, schema, text, type, workspace} from 'alinea'
import {MdInsertDriveFile, MdOutlinePermMedia} from 'react-icons/md'

export const config = createConfig({
  workspaces: {
    main: workspace('Example', {
      source: './content',
      schema: schema({
        ...MediaSchema,
        Home: type('Home', {
          title: text('Title')
        })
      }),
      roots: {
        data: {
          icon: MdInsertDriveFile,
          contains: ['Home']
        },
        media: {
          icon: MdOutlinePermMedia,
          contains: ['MediaLibrary']
        }
      }
    })
  }
})
