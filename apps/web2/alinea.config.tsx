import alinea from 'alinea'
import {createNextCMS} from 'alinea/core/driver/NextDriver'
import {BrowserPreview} from 'alinea/preview'
import {IcRoundPermMedia} from 'alinea/ui/icons/IcRoundPermMedia'
import * as schema from './content/schema'

export const cms = createNextCMS({
  schema,
  workspaces: {
    main: alinea.workspace('Alinea website', {
      pages: alinea.root('Pages', {
        contains: ['page']
      }),
      media: alinea.root('Media', {
        contains: ['MediaLibrary'],
        icon: IcRoundPermMedia
      }),
      [alinea.workspace.meta]: {
        color: '#3F61E8',
        source: './content'
      }
    })
  },
  preview({previewSearch}) {
    const location =
      process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : ''
    return <BrowserPreview url={`${location}/api/preview${previewSearch}`} />
  }
})
