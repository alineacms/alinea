import {createCMS} from 'alinea/adapter/test/TestCMS'
import {document} from 'alinea/core/Document'
import {page} from 'alinea/core/Page'
import {root} from 'alinea/core/Root'
import {type} from 'alinea/core/Type'
import {workspace} from 'alinea/core/Workspace'
import {createMediaRoot} from 'alinea/core/media/MediaRoot'
import {MediaFile, MediaLibrary} from 'alinea/core/media/MediaTypes'
import {
  check,
  code,
  date,
  entry,
  image,
  link,
  list,
  number,
  object,
  path,
  richText,
  select,
  tab,
  tabs,
  text,
  url
} from 'alinea/field'

export function createExample() {
  const Page = document('Type', {
    contains: ['Page'],
    fields: {
      title: text('Title'),
      path: path('Path'),
      ...tabs(
        tab('Tab 1', {
          fields: {
            name: path('Name')
          }
        }),
        tab('Tab 2', {
          fields: {
            name: text('Name'),
            name2: text('Name')
          }
        })
      )
    }
  })

  const Container = type('TypeB', {
    contains: ['Page'],
    fields: {
      title: text('Title'),
      path: path('Path'),
      name: text('name')
    }
  })

  const Fields = document('Fields', {
    fields: {
      text: text('Text field'),
      hello: text('Validated text field', {
        help: 'This field only accepts "hello"',
        validate: value => {
          if (value !== 'hello') {
            return 'Only "hello" is allowed'
          }
        }
      }),
      richText: richText('Rich text field'),
      select: select('Select field', {
        options: {
          a: 'Option a',
          b: 'Option b'
        }
      }),
      number: number('Number field', {
        minValue: 0,
        maxValue: 10
      }),
      check: check('Check field', {description: 'Check me please'}),
      date: date('Date field'),
      code: code('Code field'),
      externalLink: url('External link'),
      entry: entry('Internal link'),
      entryWithCondition: entry('With condition', {
        help: `Show only entries of type Fields`,
        condition: {_type: 'Fields'}
      }),
      linkMultiple: link.multiple('Mixed links, multiple'),
      image: image('Image link'),
      images: image.multiple('Image link (multiple)'),
      file: entry('File link'),
      withFields: link('With extra fields', {
        fields: {
          fieldA: text('Field A', {width: 0.5}),
          fieldB: text('Field B', {width: 0.5})
        }
      }),
      multipleWithFields: link.multiple('Multiple With extra fields', {
        fields: {
          fieldA: text('Field A', {width: 0.5}),
          fieldB: text('Field B', {width: 0.5, required: true})
        }
      }),
      list: list('My list field', {
        schema: {
          Text: type('Text', {
            fields: {
              title: text('Item title'),
              text: richText('Item body text')
            }
          }),
          Image: type('Image', {
            fields: {
              image: image('Image')
            }
          })
        }
      }),
      withInitial: richText('With initial value', {
        required: true,
        initialValue: [
          {
            _type: 'paragraph',
            content: [
              {_type: 'text', text: 'This is a paragraph with initial value'}
            ]
          }
        ]
      }),
      nested: richText('With nested blocks', {
        schema: {
          Inner: type('Inner', {
            fields: {
              checkbox1: check('Checkbox 1'),
              checkbox2: check('Checkbox 2'),
              title: text('Title'),
              content: richText('Inner rich text')
            }
          }),

          NestLayout: type('Nested layout fields', {
            fields: {
              object: object('Object field', {
                fields: {
                  fieldA: text('Field A', {width: 0.5}),
                  fieldB: text('Field B', {width: 0.5})
                }
              }),
              ...tabs(
                tab('Tab A', {
                  fields: {
                    tabA: text('Tab A')
                  }
                }),
                tab('Tab B', {
                  fields: {
                    tabB: text('Tab B')
                  }
                })
              )
            }
          })
        }
      })
    }
  })

  const main = workspace('Main', {
    source: '.',
    roots: {
      pages: root('Pages', {
        contains: ['Page', 'Container'],
        entries: {
          entry1: page({type: Page, fields: {title: 'Test title'}}),
          entry2: page({
            type: Container,
            fields: {title: 'Entry 2'},
            children: {
              entry3: page({type: Page, fields: {title: 'Entry 3'}})
            }
          }),
          container1: page({type: Container, fields: {title: 'Container 1'}})
        }
      }),
      multiLanguage: root('Multi language', {
        contains: ['Page', 'Container'],
        i18n: {
          locales: ['en', 'fr']
        },
        entries: {
          localised1: page({type: Page, fields: {title: 'Test title'}}),
          localised2: page({
            type: Container,
            fields: {title: 'Entry 2'},
            children: {
              localised3: page({type: Page, fields: {title: 'Entry 3'}})
            }
          })
        }
      }),
      media: createMediaRoot({
        dir: page({
          type: MediaLibrary,
          fields: {title: 'Media folder'},
          children: {
            'file1.png': page({
              type: MediaFile,
              fields: {
                title: 'File 1',
                path: 'file1.png',
                extension: '.png',
                size: 1000,
                width: 120,
                height: 120,
                hash: 'hash1',
                preview: `data:image/png;base64,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`,
                averageColor: '#ffffff',
                focus: {x: 0.5, y: 0.5}
              }
            })
          }
        })
      })
    }
  })

  return createCMS({
    schema: {Fields, Page, Container},
    workspaces: {main}
  })
}
