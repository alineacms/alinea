import alinea from 'alinea'
import {createNextCMS} from 'alinea/core/driver/Next13Driver'
import {IcRoundPermMedia} from 'alinea/ui/icons/IcRoundPermMedia'
import * as schema from './content/schema'

export const pages = alinea.root('Pages', {
  contains: ['page']
})

export {schema}

export const cms = createNextCMS({
  schema,
  workspaces: {
    main: alinea.workspace('Alinea', {
      pages,
      media: alinea.root('Media', {
        contains: ['MediaLibrary'],
        icon: IcRoundPermMedia
      }),
      [alinea.workspace.meta]: {
        source: './content'
      }
    })
  }
})
