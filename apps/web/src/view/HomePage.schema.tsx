import {schema, type} from 'alinea/core'
import {link} from 'alinea/input/link'
import {list} from 'alinea/input/list'
import {object} from 'alinea/input/object'
import {path} from 'alinea/input/path'
import {richText} from 'alinea/input/richtext'
import {tab, tabs} from 'alinea/input/tabs'
import {text} from 'alinea/input/text'
import {IcRoundInsertDriveFile} from 'alinea/ui/icons/IcRoundInsertDriveFile'
import {IcRoundLink} from 'alinea/ui/icons/IcRoundLink'
import {BlocksSchema} from './blocks/Blocks.schema'
import {CodeVariants} from './blocks/CodeVariantsBlock.schema'

export const HomePageSchema = type(
  'Home',
  tabs(
    tab('Homepage', {
      title: text('Title', {
        width: 0.5,
        multiline: true
      }),
      path: path('Path', {width: 0.5}),
      headline: text('Headline', {multiline: true}),
      byline: text('Byline', {multiline: true}),
      action: link.entry('Action', {
        fields: type('Fields', {
          label: text('Button label')
        })
      }),
      screenshot: link.image('Screenshot'),
      introduction: object('Introduction', {
        fields: type('Fields', {
          text: richText('Text'),
          code: CodeVariants
        })
      }),
      blocks: BlocksSchema
    }).configure({icon: IcRoundInsertDriveFile}),
    tab('Top navigation', {
      links: link.multiple('Links', {
        type: ['entry', 'external'],
        fields: type('Fields', {
          label: text('Label'),
          active: text('Active url', {help: 'Active when this url is active'})
        })
      })
    }).configure({icon: IcRoundLink}),
    tab('Footer navigation', {
      footer: list('Navigation', {
        schema: schema({
          Section: type('Section', {
            label: text('Label'),
            links: link.multiple('Links', {
              type: ['entry', 'external'],
              fields: type('Fields', {
                label: text('Label')
              })
            })
          })
        })
      })
    }).configure({icon: IcRoundLink})
  )
)
