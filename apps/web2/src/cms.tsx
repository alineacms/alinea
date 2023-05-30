// @ts-nocheck

import alinea from 'alinea'
import {createNextCMS} from 'alinea/core/driver/NextDriver'
import {IcRoundPermMedia} from 'alinea/ui/icons/IcRoundPermMedia'
import * as schema from './schema'

export const pages = alinea.root('Pages', {
  contains: ['page']
})

export const cms = createNextCMS({
  schema,
  workspaces: {
    main: alinea.workspace('Alinea website', {
      pages: pages,
      media: alinea.root('Media', {
        contains: ['MediaLibrary'],
        icon: IcRoundPermMedia
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
