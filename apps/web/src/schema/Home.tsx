import {Config, Field} from 'alinea'
import {IcRoundInsertDriveFile} from 'alinea/ui/icons/IcRoundInsertDriveFile'
import {IcRoundLink} from 'alinea/ui/icons/IcRoundLink'

export const Home = Config.document('Home', {
  fields: {
    title: Field.text('Title'),
    path: Field.path('Path', {hidden: true}),
    ...Field.tabs(
      Field.tab('Homepage', {
        icon: IcRoundInsertDriveFile,
        fields: {
          headline: Field.text('Headline', {multiline: true, required: true}),
          byline: Field.text('Byline', {multiline: true, required: true}),
          action: Field.entry('Action', {
            fields: {
              label: Field.text('Button label')
            }
          }),
          screenshot: Field.image('Screenshot'),
          introduction: Field.object('Introduction', {
            fields: {
              text: Field.richText('Text')
              // code: CodeVariants
            }
          })
        }
      }),
      Field.tab('Top navigation', {
        icon: IcRoundLink,
        fields: {
          links: Field.link.multiple('Links', {
            fields: {
              label: Field.text('Label'),
              active: Field.text('Active url', {
                help: 'Active when this url is active'
              })
            }
          })
        }
      }),
      Field.tab('Footer navigation', {
        icon: IcRoundLink,
        fields: {
          footer: Field.list('Navigation', {
            schema: {
              Section: Config.type('Section', {
                fields: {
                  label: Field.text('Label'),
                  links: Field.link.multiple('Links', {
                    fields: {
                      label: Field.text('Label')
                    }
                  })
                }
              })
            }
          })
        }
      })
    )
  }
})
