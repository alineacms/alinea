import alinea, {createCMS} from 'alinea'
import {Entry} from 'alinea/core'
import {IcRoundTranslate} from 'alinea/ui/icons/IcRoundTranslate'
import {IcRoundUploadFile} from 'alinea/ui/icons/IcRoundUploadFile'
import {position} from './src/PositionField'

const Page = alinea.document('Page', {})

const Folder = alinea.type('Folder', {
  title: alinea.text('Title', {
    width: 0.5
  }),
  path: alinea.path('Path', {
    width: 0.5
  }),
  [alinea.meta]: {
    isContainer: true
  }
})

const CustomPage = alinea.document('Custom page', {
  [alinea.meta]: {
    view() {
      return (
        <div style={{width: '100%', height: '100%', background: 'red'}}>
          Custom entry view
        </div>
      )
    }
  }
})

// alineacms/alinea#353
const TabsExample = alinea.type('Tabs Example', {
  path: alinea.path('Path', {
    hidden: true
  }),
  ...alinea.tabs(
    alinea.tab('Tab 1', {
      title: alinea.text('Title')
    }),
    alinea.tab('Tab 2', {
      another_title: alinea.text('Another title')
    })
  )
})

const Fields = alinea.document('Fields', {
  ...alinea.tabs(
    alinea.tab('Custom field', {
      position: position('Position field')
    }),
    alinea.tab('Basic fields', {
      richText: alinea.richText('Rich text field'),
      select: alinea.select('Select field', {
        a: 'Option a',
        b: 'Option b'
      }),
      number: alinea.number('Number field', {
        minValue: 0,
        maxValue: 10
      }),
      check: alinea.check('Check field', {description: 'Check me please'}),
      date: alinea.date('Date field'),
      code: alinea.code('Code field')
    }),
    alinea.tab('Link fields', {
      externalLink: alinea.url('External link'),
      entry: alinea.entry('Internal link'),
      entryWithCondition: alinea.entry('With condition', {
        help: `Show only entries of type Fields`,
        condition: Entry.type.is('Fields')
      }),
      linkMultiple: alinea.link.multiple('Mixed links, multiple'),
      image: alinea.image('Image link'),
      images: alinea.image.multiple('Image link (multiple)'),
      file: alinea.entry('File link')
    }),
    alinea.tab('List fields', {
      list: alinea.list('My list field', {
        schema: alinea.schema({
          Text: alinea.type('Text', {
            title: alinea.text('Item title'),
            text: alinea.richText('Item body text')
          }),
          Image: alinea.type('Image', {
            image: alinea.image('Image')
          })
        })
      })
    }),
    alinea.tab('Rich text fields', {
      nested: alinea.richText('With nested blocks', {
        schema: {
          Inner: alinea.type('Inner', {
            checkbox1: alinea.check('Checkbox 1'),
            checkbox2: alinea.check('Checkbox 2'),
            title: alinea.text('Title'),
            content: alinea.richText('Inner rich text')
          }),

          NestLayout: alinea.type('Nested layout fields', {
            object: alinea.object('Object field', {
              fields: alinea.type('Fields', {
                fieldA: alinea.text('Field A', {width: 0.5}),
                fieldB: alinea.text('Field B', {width: 0.5})
              })
            }),
            ...alinea.tabs(
              alinea.tab('Tab A', {
                tabA: alinea.text('Tab A')
              }),
              alinea.tab('Tab B', {
                tabB: alinea.text('Tab B')
              })
            )
          })
        }
      })
    }),
    alinea.tab('Inline fields', {
      street: alinea.text('Street', {
        width: 0.6,
        inline: true,
        multiline: true
      }),
      streetNr: alinea.text('Number', {width: 0.2, inline: true}),
      box: alinea.text('Box', {width: 0.2, inline: true}),
      zip: alinea.text('Zipcode', {width: 0.2, inline: true}),
      city: alinea.text('City', {width: 0.4, inline: true}),
      country: alinea.text('Country', {
        width: 0.4,
        inline: true
      })
    }),
    alinea.tab('Layout fields', {
      object: alinea.object('Object field', {
        fields: alinea.type('Fields', {
          fieldA: alinea.text('Field A', {width: 0.5}),
          fieldB: alinea.text('Field B', {width: 0.5})
        })
      }),
      ...alinea.tabs(
        alinea.tab('Tab A', {
          tabA: alinea.text('Tab A')
        }),
        alinea.tab('Tab B', {
          tabB: alinea.text('Tab B')
        })
      )
    })
  )
})

const schema = alinea.schema({
  Page,
  Folder,
  CustomPage,
  TabsExample,
  Fields
})

export const cms = createCMS({
  schema,
  workspaces: {
    primary: alinea.workspace('Primary workspace', {
      fields: alinea.root('Fields', {
        [alinea.meta]: {
          contains: ['Folder', 'TabsExample'],
          icon: IcRoundUploadFile
        }
      }),
      pages: alinea.root('Languages', {
        [alinea.meta]: {
          icon: IcRoundTranslate,
          contains: ['TabsExample', 'Fields', 'Page', 'Folder'],
          i18n: {
            locales: ['en', 'fr', 'nl']
          }
        }
      }),
      custom: alinea.root('Custom', {
        [alinea.meta]: {
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
        }
      }),
      media: alinea.media(),
      [alinea.meta]: {
        mediaDir: 'public',
        source: 'content/primary'
      }
    }),
    secondary: alinea.workspace('Secondary workspace', {
      pages: alinea.root('Pages', {
        [alinea.meta]: {
          contains: ['Page', 'Folder']
        }
      }),
      [alinea.meta]: {
        source: 'content/secondary'
      }
    })
  }
})
