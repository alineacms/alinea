import {Config, Field} from 'alinea'
import {IcRoundLink} from 'alinea/ui/icons/IcRoundLink'
import {CodeTextBlock} from './blocks/CodeTextBlock'
import {FeaturesBlock} from './blocks/FeaturesBlock'
import {ImageTextBlock} from './blocks/ImageTextBlock'
import {QuickLinksBlock} from './blocks/QuickLinksBlock'
import {TemplateBlock} from './blocks/TemplateBlock'

export const Home = Config.document('Home', {
  fields: {
    title: Field.text('Title'),
    path: Field.path('Path', {hidden: true}),
    ...Field.tabs(
      Field.tab('Hero', {
        fields: {
          hero: Field.object('Hero', {
            inline: true,
            fields: {
              headline: Field.text('Headline', {
                multiline: true,
                required: true
              }),
              byline: Field.text('Byline', {multiline: true, required: true}),
              button: Field.link('Button', {
                width: 0.5,
                fields: {
                  label: Field.text('Button label')
                }
              }),
              link: Field.link('Link', {
                width: 0.5,
                fields: {
                  label: Field.text('Link label')
                }
              })
            }
          })
        }
      }),
      Field.tab('Body', {
        fields: {
          body: Field.richText('Body', {
            searchable: true,
            schema: {
              CodeTextBlock,
              FeaturesBlock,
              ImageTextBlock,
              TemplateBlock,
              QuickLinksBlock
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
