import {Config} from 'alinea'
import {createCMS} from 'alinea/next'
import {IcRoundTranslate} from 'alinea/ui/icons/IcRoundTranslate'
import {IcRoundUploadFile} from 'alinea/ui/icons/IcRoundUploadFile'
import * as schema from './schema'

export const cms = createCMS({
  schema,
  workspaces: {
    primary: Config.workspace('Primary workspace', {
      mediaDir: 'public',
      source: 'content/primary',
      roots: {
        fields: Config.root('Fields', {
          icon: IcRoundUploadFile
        }),
        pages: Config.root('Languages', {
          icon: IcRoundTranslate,
          i18n: {
            locales: ['en', 'fr', 'nl']
          },
          entries: {
            seededPath: Config.page(
              schema.Page({
                title: 'Seeded page'
              })
            )
          }
        }),
        custom: Config.root('Custom', {
          contains: ['CustomPage'],
          view() {
            return (
              <div
                style={{width: '100%', height: '100%', background: 'yellow'}}
              >
                Custom root view
              </div>
            )
          }
        }),
        media: Config.media()
      }
    }),
    secondary: Config.workspace('Secondary workspace', {
      source: 'content/secondary',
      roots: {
        pages: Config.root('Pages', {
          contains: ['Page', 'Folder']
        })
      }
    })
  }
})
