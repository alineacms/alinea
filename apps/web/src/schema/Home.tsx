import alinea from 'alinea'
import {IcRoundInsertDriveFile} from 'alinea/ui/icons/IcRoundInsertDriveFile'
import {IcRoundLink} from 'alinea/ui/icons/IcRoundLink'

export const Home = alinea.document('Home', {
  ...alinea.tabs(
    alinea.tab('Homepage', {
      headline: alinea.text('Headline', {multiline: true}),
      byline: alinea.text('Byline', {multiline: true}),
      action: alinea.link.entry('Action', {
        fields: alinea.type('Fields', {
          label: alinea.text('Button label')
        })
      }),
      screenshot: alinea.link.image('Screenshot'),
      introduction: alinea.object('Introduction', {
        fields: alinea.type('Fields', {
          text: alinea.richText('Text')
          // code: CodeVariants
        })
      }),
      [alinea.meta]: {
        icon: IcRoundInsertDriveFile
      }
    }),
    alinea.tab('Top navigation', {
      links: alinea.link.multiple('Links', {
        fields: alinea.type('Fields', {
          label: alinea.text('Label'),
          active: alinea.text('Active url', {
            help: 'Active when this url is active'
          })
        })
      }),
      [alinea.meta]: {
        icon: IcRoundLink
      }
    }),
    alinea.tab('Footer navigation', {
      footer: alinea.list('Navigation', {
        schema: alinea.schema({
          Section: alinea.type('Section', {
            label: alinea.text('Label'),
            links: alinea.link.multiple('Links', {
              fields: alinea.type('Fields', {
                label: alinea.text('Label')
              })
            })
          })
        })
      }),
      [alinea.meta]: {
        icon: IcRoundLink
      }
    })
  )
})
