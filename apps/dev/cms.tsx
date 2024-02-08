import {Config, Field, Query} from 'alinea'
import {createCMS} from 'alinea/core'
import {IcRoundTranslate} from 'alinea/ui/icons/IcRoundTranslate'
import {IcRoundUploadFile} from 'alinea/ui/icons/IcRoundUploadFile'
import {position} from './src/PositionField'

const Page = Config.document('Page', {
  fields: {}
})

const Folder = Config.type('Folder', {
  isContainer: true,
  fields: {
    title: Field.text('Title', {
      width: 0.5
    }),
    path: Field.path('Path', {
      width: 0.5
    })
  }
})

const CustomPage = Config.document('Custom page', {
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
const TabsExample = Config.type('Tabs Example', {
  fields: {
    path: Field.path('Path', {
      hidden: true
    }),
    ...Field.tabs(
      Field.tab('Tab 1', {
        fields: {title: Field.text('Title')}
      }),
      Field.tab('Tab 2', {
        fields: {another_title: Field.text('Another title')}
      })
    )
  }
})

const rootField = Field.select('Root field', {
  initialValue: 'a',
  options: {
    a: 'Option a',
    b: 'Option b'
  }
})

const showIfA = Config.track.options(Field.text('Show if A'), get => {
  return {hidden: get(rootField) !== 'a'}
})
const showIfB = Config.track.options(Field.text('Show if B'), get => {
  return {hidden: get(rootField) !== 'b'}
})

const nestedList = Field.list('Nested list', {
  schema: {
    Row: Config.type('List item', {
      fields: {
        a: showIfA,
        b: showIfB
      }
    })
  }
})

const Fields = Config.document('Fields', {
  ...Field.tabs(
    Field.tab('Basic fields', {
      fields: {
        text: Field.text('Text field'),
        hello: Field.text('Validated text field', {
          help: 'This field only accepts "hello"',
          validate: value => {
            if (value !== 'hello') {
              return 'Only "hello" is allowed'
            }
          }
        }),
        richText: Field.richText('Rich text field'),
        select: Field.select('Select field', {
          a: 'Option a',
          b: 'Option b'
        }),
        number: Field.number('Number field', {
          minValue: 0,
          maxValue: 10
        }),
        check: Field.check('Check field', {description: 'Check me please'}),
        date: Field.date('Date field'),
        code: Field.code('Code field')
      }
    }),
    Field.tab('Link fields', {
      fields: {
        externalLink: Field.url('External link'),
        entry: Field.entry('Internal link'),
        entryWithCondition: Field.entry('With condition', {
          help: `Show only entries of type Fields`,
          condition: Query.whereType('Fields')
        }),
        linkMultiple: Field.link.multiple('Mixed links, multiple'),
        image: Field.image('Image link'),
        images: Field.image.multiple('Image link (multiple)'),
        file: Field.entry('File link'),
        withFields: Field.link('With extra fields', {
          fields: {
            fieldA: Field.text('Field A', {width: 0.5}),
            fieldB: Field.text('Field B', {width: 0.5})
          }
        }),
        multipleWithFields: Field.link.multiple('Multiple With extra fields', {
          fields: {
            fieldA: Field.text('Field A', {width: 0.5}),
            fieldB: Field.text('Field B', {width: 0.5, required: true})
          }
        })
      }
    }),
    Field.tab('List fields', {
      fields: {
        list: Field.list('My list field', {
          schema: {
            Text: Config.type('Text', {
              fields: {
                title: Field.text('Item title'),
                text: Field.richText('Item body text')
              }
            }),
            Image: Config.type('Image', {
              fields: {image: Field.image('Image')}
            })
          }
        })
      }
    }),
    Field.tab('Rich text fields', {
      fields: {
        withInitial: Field.richText('With initial value', {
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
        makeRO: Field.check('Make read-only'),
        nested: Field.richText('With nested blocks', {
          schema: {
            Inner: Config.type('Inner', {
              fields: {
                checkbox1: Field.check('Checkbox 1'),
                checkbox2: Field.check('Checkbox 2'),
                title: Field.text('Title'),
                content: Field.richText('Inner rich text')
              }
            }),

            NestLayout: Config.type('Nested layout fields', {
              object: Field.object('Object field', {
                fields: {
                  fieldA: Field.text('Field A', {width: 0.5}),
                  fieldB: Field.text('Field B', {width: 0.5})
                }
              }),
              ...Field.tabs(
                Field.tab('Tab A', {
                  fields: {tabA: Field.text('Tab A')}
                }),
                Field.tab('Tab B', {
                  fields: {tabB: Field.text('Tab B')}
                })
              )
            })
          }
        })
      }
    }),
    Field.tab('Inline fields', {
      fields: {
        street: Field.text('Street', {
          width: 0.6,
          inline: true,
          multiline: true
        }),
        streetNr: Field.text('Number', {width: 0.2, inline: true}),
        box: Field.text('Box', {width: 0.2, inline: true}),
        zip: Field.text('Zipcode', {width: 0.2, inline: true}),
        city: Field.text('City', {width: 0.4, inline: true}),
        country: Field.text('Country', {
          width: 0.4,
          inline: true
        })
      }
    }),
    Field.tab('Layout fields', {
      fields: {
        object: Field.object('Object field', {
          fields: {
            fieldA: Field.text('Field A', {width: 0.5}),
            fieldB: Field.text('Field B', {width: 0.5})
          }
        }),
        ...Field.tabs(
          Field.tab('Tab A', {
            fields: {tabA: Field.text('Tab A', {shared: true})}
          }),
          Field.tab('Tab B', {
            fields: {tabB: Field.text('Tab B')}
          })
        )
      }
    }),
    Field.tab('Custom field', {
      fields: {position: position('Position field')}
    }),
    Field.tab('I18n', {
      fields: {
        shared: Field.text('Shared field', {
          help: `This field is shared between languages.`,
          shared: true
        })
      }
    }),
    Field.tab('Conditional fields', {
      fields: {
        rootField,
        nestedList
      }
    })
  )
})

Config.track.options(Fields.nested, get => {
  return {readOnly: get(Fields.makeRO)}
})

const schema = Config.schema({
  types: {
    Page,
    Folder,
    CustomPage,
    TabsExample,
    Fields
  }
})

export const cms = createCMS({
  schema,
  workspaces: {
    primary: Config.workspace('Primary workspace', {
      mediaDir: 'public',
      source: 'content/primary',
      roots: {
        fields: Config.root('Fields', {
          contains: ['Folder', 'TabsExample', 'Fields'],
          icon: IcRoundUploadFile
        }),
        pages: Config.root('Languages', {
          icon: IcRoundTranslate,
          contains: ['TabsExample', 'Fields', 'Page', 'Folder'],
          i18n: {
            locales: ['en', 'fr', 'nl']
          },
          entries: {
            seededPath: Config.page(
              Fields({
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
