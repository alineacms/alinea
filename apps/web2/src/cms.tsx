import alinea from 'alinea'
import {createNextCMS} from 'alinea/core/driver/NextDriver'
import {IcRoundPermMedia} from 'alinea/ui/icons/IcRoundPermMedia'
import * as schema from './schema'

export const pages = alinea.root('Pages', {
  index: alinea.page(schema.Home),
  docs: alinea.page(schema.Docs)
})

export const cms = createNextCMS({
  schema,
  workspaces: {
    main: alinea.workspace('Alinea website', {
      pages,
      media: alinea.root('Media', {
        [alinea.meta]: {
          contains: ['MediaLibrary'],
          icon: IcRoundPermMedia
        }
      }),
      [alinea.meta]: {
        color: '#3F61E8',
        source: '../content'
      }
    })
  },
  preview:
    process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000/api/preview'
      : ''
})
