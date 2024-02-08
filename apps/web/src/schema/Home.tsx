import alinea from 'alinea'
import {IcRoundInsertDriveFile} from 'alinea/ui/icons/IcRoundInsertDriveFile'
import {IcRoundLink} from 'alinea/ui/icons/IcRoundLink'

export const Home = alinea.document('Home', {
  fields: {
    title: alinea.text('Title'),
    path: alinea.path('Path', {
      hidden: true
    }),
    ...alinea.tabs(
      alinea.tab('Homepage', {
        icon: IcRoundInsertDriveFile,
        fields: {
          headline: alinea.text('Headline', {multiline: true, required: true}),
          byline: alinea.text('Byline', {multiline: true, required: true}),
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
          })
        }
      }),
      alinea.tab('Top navigation', {
        icon: IcRoundLink,
        fields: {
          links: alinea.link.multiple('Links', {
            fields: alinea.type('Fields', {
              label: alinea.text('Label'),
              active: alinea.text('Active url', {
                help: 'Active when this url is active'
              })
            })
          })
        }
      }),
      alinea.tab('Footer navigation', {
        icon: IcRoundLink,
        fields: {
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
          })
        }
      })
    )
  }
})
