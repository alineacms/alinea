import alinea, {Query} from 'alinea'
import {createCMS} from 'alinea/core'
import {IcRoundTranslate} from 'alinea/ui/icons/IcRoundTranslate'
import {IcRoundUploadFile} from 'alinea/ui/icons/IcRoundUploadFile'
import {position} from './src/PositionField'

const Page = alinea.document('Page', {
  fields: {}
})

const Folder = alinea.type('Folder', {
  isContainer: true,
  fields: {
    title: alinea.text('Title', {
      width: 0.5
    }),
    path: alinea.path('Path', {
      width: 0.5
    })
  }
})

const CustomPage = alinea.document('Custom page', {
  view() {
    return (
      <div style={{width: '100%', height: '100%', background: 'red'}}>
        Custom entry view
      </div>
    )
  },
  fields: {}
})

// alineacms/alinea#353
const TabsExample = alinea.type('Tabs Example', {
  fields: {
    path: alinea.path('Path', {
      hidden: true
    }),
    ...alinea.tabs(
      alinea.tab('Tab 1', {
        fields: {title: alinea.text('Title')}
      }),
      alinea.tab('Tab 2', {
        fields: {another_title: alinea.text('Another title')}
      })
    )
  }
})

const rootField = alinea.select('Root field', {
  initialValue: 'a',
  options: {
    a: 'Option a',
    b: 'Option b'
  }
})

const showIfA = alinea.track.options(alinea.text('Show if A'), get => {
  return {hidden: get(rootField) !== 'a'}
})
const showIfB = alinea.track.options(alinea.text('Show if B'), get => {
  return {hidden: get(rootField) !== 'b'}
})

const nestedList = alinea.list('Nested list', {
  schema: alinea.schema({
    Row: alinea.type('List item', {
      fields: {
        a: showIfA,
        b: showIfB
      }
    })
  })
})

const Fields = alinea.document('Fields', {
  ...alinea.tabs(
    alinea.tab('Basic fields', {
      fields: {
        text: alinea.text('Text field'),
        hello: alinea.text('Validated text field', {
          help: 'This field only accepts "hello"',
          validate: value => {
            if (value !== 'hello') {
              return 'Only "hello" is allowed'
            }
          }
        }),
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
      }
    }),
    alinea.tab('Link fields', {
      fields: {
        externalLink: alinea.url('External link'),
        entry: alinea.entry('Internal link'),
        entryWithCondition: alinea.entry('With condition', {
          help: `Show only entries of type Fields`,
          condition: Query.whereType('Fields')
        }),
        linkMultiple: alinea.link.multiple('Mixed links, multiple'),
        image: alinea.image('Image link'),
        images: alinea.image.multiple('Image link (multiple)'),
        file: alinea.entry('File link'),
        withFields: alinea.link('With extra fields', {
          fields: alinea.type({
            fieldA: alinea.text('Field A', {width: 0.5}),
            fieldB: alinea.text('Field B', {width: 0.5})
          })
        }),
        multipleWithFields: alinea.link.multiple('Multiple With extra fields', {
          fields: alinea.type({
            fieldA: alinea.text('Field A', {width: 0.5}),
            fieldB: alinea.text('Field B', {width: 0.5, required: true})
          })
        })
      }
    }),
    alinea.tab('List fields', {
      fields: {
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
      }
    }),
    alinea.tab('Rich text fields', {
      fields: {
        withInitial: alinea.richText('With initial value', {
          required: true,
          initialValue: [
            {
              type: 'paragraph',
              content: [
                {type: 'text', text: 'This is a paragraph with initial value'}
              ]
            }
          ]
        }),
        makeRO: alinea.check('Make read-only'),
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
                  fields: {tabA: alinea.text('Tab A')}
                }),
                alinea.tab('Tab B', {
                  fields: {tabB: alinea.text('Tab B')}
                })
              )
            })
          }
        })
      }
    }),
    alinea.tab('Inline fields', {
      fields: {
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
      }
    }),
    alinea.tab('Layout fields', {
      fields: {
        object: alinea.object('Object field', {
          fields: alinea.type('Fields', {
            fieldA: alinea.text('Field A', {width: 0.5}),
            fieldB: alinea.text('Field B', {width: 0.5})
          })
        }),
        ...alinea.tabs(
          alinea.tab('Tab A', {
            fields: {tabA: alinea.text('Tab A', {shared: true})}
          }),
          alinea.tab('Tab B', {
            fields: {tabB: alinea.text('Tab B')}
          })
        )
      }
    }),
    alinea.tab('Custom field', {
      fields: {position: position('Position field')}
    }),
    alinea.tab('I18n', {
      fields: {
        shared: alinea.text('Shared field', {
          help: `This field is shared between languages.`,
          shared: true
        })
      }
    }),
    alinea.tab('Conditional fields', {
      fields: {
        rootField,
        nestedList
      }
    })
  )
})

alinea.track.options(Fields.nested, get => {
  return {readOnly: get(Fields.makeRO)}
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
      mediaDir: 'public',
      source: 'content/primary',
      roots: {
        fields: alinea.root('Fields', {
          contains: ['Folder', 'TabsExample', 'Fields'],
          icon: IcRoundUploadFile
        }),
        pages: alinea.root('Languages', {
          icon: IcRoundTranslate,
          contains: ['TabsExample', 'Fields', 'Page', 'Folder'],
          i18n: {
            locales: ['en', 'fr', 'nl']
          },
          entries: {
            seededPath: alinea.page(
              Fields({
                title: 'Seeded page'
              })
            )
          }
        }),
        custom: alinea.root('Custom', {
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
        media: alinea.media()
      }
    }),
    secondary: alinea.workspace('Secondary workspace', {
      source: 'content/secondary',
      roots: {
        pages: alinea.root('Pages', {
          contains: ['Page', 'Folder']
        })
      }
    })
  }
})
