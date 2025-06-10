import {Config} from 'alinea'
import {createCMS} from 'alinea/next'
import {IcRoundTranslate} from 'alinea/ui/icons/IcRoundTranslate'
import {IcRoundUploadFile} from 'alinea/ui/icons/IcRoundUploadFile'
import * as schema from './schema'

const editor = Config.role('Editor', {
  permissions(policy) {
    policy.setAll({
      create: false,
      read: true,
      update: true,
      delete: false,
      reorder: false,
      move: false,
      publish: false,
      archive: false,
      upload: true,
      explore: true
    })
  }
})

export const cms = createCMS({
  enableDrafts: true,
  schema,
  roles: {editor},
  workspaces: {
    primary: Config.workspace('Primary workspace', {
      mediaDir: 'public',
      source: 'content/primary',
      roots: {
        fields: Config.root('Fields', {
          icon: IcRoundUploadFile
        }),
        pages: Config.root('Languages', {
          contains: [
            schema.Page,
            schema.Folder,
            schema.LinkFields,
            schema.SharedFields
          ],
          icon: IcRoundTranslate,
          i18n: {
            locales: ['en', 'fr', 'nl-BE', 'nl-NL']
          },
          children: {
            seededPath: Config.page({
              type: schema.Page,
              fields: {
                title: 'Seeded page'
              }
            })
          }
        }),
        custom: Config.root('Custom', {
          contains: [schema.CustomPage],
          view: './src/CustomRootView.tsx#CustomRootView'
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
