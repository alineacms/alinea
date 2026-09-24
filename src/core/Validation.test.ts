import {Config, Field} from '#/index.js'
import {expect, test} from 'bun:test'
import {createConfig} from './Config.js'
import {WriteablePolicy} from './Role.js'
import {getScope} from './Scope.js'
import {track} from './Tracker.js'
import {
  formatFieldPath,
  formatValidationErrors,
  policyFieldOptions,
  validateEntry
} from './Validation.js'

function messages(type: Parameters<typeof validateEntry>[0], data: unknown) {
  return validateEntry(type, data).map(error => [
    formatFieldPath(error.path),
    error.message
  ])
}

test('required rejects missing values of each kind', () => {
  const type = Config.type('Kinds', {
    fields: {
      text: Field.text('Text', {required: true}),
      number: Field.number('Number', {required: true}),
      check: Field.check('Check', {required: true}),
      select: Field.select('Select', {
        required: true,
        options: {a: 'A', b: 'B'}
      }),
      list: Field.list('List', {
        required: true,
        schema: {Row: Config.type('Row', {fields: {}})}
      }),
      link: Field.entry('Link', {required: true}),
      rich: Field.richText('Rich', {required: true}),
      json: Field.json('Json', {required: true})
    }
  })
  expect(
    messages(type, {
      text: '',
      number: null,
      select: null,
      list: [],
      link: {},
      rich: [{_type: 'paragraph', content: [{_type: 'text', text: '  '}]}]
    })
  ).toEqual([
    ['text', 'Field is required'],
    ['number', 'Field is required'],
    ['check', 'Field is required'],
    ['select', 'Field is required'],
    ['list', 'Field is required'],
    ['link', 'Field is required'],
    ['rich', 'Field is required'],
    ['json', 'Field is required']
  ])
  expect(
    messages(type, {
      text: 'a',
      number: 0,
      check: false,
      select: 'a',
      list: [{_id: 'r', _type: 'Row', _index: 'a0'}],
      link: {_id: 'l', _type: 'entry', _index: 'a0', _entry: 'x'},
      rich: [{_type: 'paragraph', content: [{_type: 'text', text: 'Hi'}]}],
      json: {a: 1}
    })
  ).toEqual([])
})

test('min and max limit the number of list rows', () => {
  const Row = Config.type('Row', {fields: {}})
  const type = Config.type('Limits', {
    fields: {
      items: Field.list('Items', {schema: {Row}, min: 2, max: 3})
    }
  })
  const row = (id: string) => ({_id: id, _type: 'Row', _index: id})
  expect(messages(type, {items: [row('a')]})).toEqual([
    ['items', 'Add at least 2 items']
  ])
  expect(
    messages(type, {items: [row('a'), row('b'), row('c'), row('d')]})
  ).toEqual([['items', 'Add at most 3 items']])
  expect(messages(type, {items: [row('a'), row('b')]})).toEqual([])
})

test('validate: true or undefined is valid, false or a string is an error', () => {
  const type = Config.type('Validate', {
    fields: {
      yes: Field.text('Yes', {validate: () => true}),
      none: Field.text('None', {validate: () => undefined}),
      no: Field.text('No', {validate: () => false}),
      message: Field.text('Message', {validate: () => 'Too short'}),
      throws: Field.text('Throws', {
        validate() {
          throw new Error('Broken')
        }
      }),
      requiredToo: Field.text('Required too', {
        required: true,
        validate: () => true
      })
    }
  })
  expect(messages(type, {})).toEqual([
    ['no', 'Field is invalid'],
    ['message', 'Too short'],
    ['throws', 'Broken'],
    ['requiredToo', 'Field is required']
  ])
})

test('nested fields in lists, objects, rich text blocks and tabs', () => {
  const Block = Config.type('Block', {
    fields: {title: Field.text('Block title', {required: true})}
  })
  const type = Config.type('Nested', {
    fields: {
      rows: Field.list('Rows', {
        schema: {
          Row: Config.type('Row', {
            fields: {
              inner: Field.list('Inner', {
                schema: {Block}
              })
            }
          })
        }
      }),
      group: Field.object('Group', {
        fields: {name: Field.text('Name', {required: true})}
      }),
      body: Field.richText('Body', {schema: {Block}}),
      ...Field.tabs(
        Field.tab('Main', {fields: {}}),
        Field.tab('Extra', {
          fields: {extra: Field.text('Extra', {required: true})}
        })
      )
    }
  })
  const errors = validateEntry(type, {
    rows: [
      {
        _id: 'r1',
        _type: 'Row',
        _index: 'a0',
        inner: [{_id: 'b1', _type: 'Block', _index: 'a0', title: ''}]
      }
    ],
    group: {name: ''},
    body: [
      {_type: 'paragraph', content: [{_type: 'text', text: 'Hi'}]},
      {_id: 'b2', _type: 'Block'}
    ],
    extra: ''
  })
  expect(errors.map(error => formatFieldPath(error.path))).toEqual([
    'rows[0].inner[0].title',
    'group.name',
    'body[1].title',
    'extra'
  ])
  expect(errors[0].labels).toEqual([
    'Rows',
    'Row',
    'Inner',
    'Block',
    'Block title'
  ])
  expect(formatValidationErrors(errors.slice(1, 2))).toBe(
    '- group.name (Group › Name): Field is required'
  )
})

test('hidden and read-only fields are ignored', () => {
  const Row = Config.type('Row', {
    fields: {title: Field.text('Title', {required: true})}
  })
  const toggle = Field.check('Toggle')
  const type = Config.type('Hidden', {
    fields: {
      hidden: Field.text('Hidden', {required: true, hidden: true}),
      readOnly: Field.text('Read only', {required: true, readOnly: true}),
      hiddenList: Field.list('Hidden list', {schema: {Row}, hidden: true}),
      toggle,
      tracked: track.options(Field.text('Tracked', {required: true}), get => ({
        hidden: !get(toggle)
      }))
    }
  })
  const data = {
    hiddenList: [{_id: 'r', _type: 'Row', _index: 'a0', title: ''}],
    toggle: false
  }
  expect(messages(type, data)).toEqual([])
  expect(messages(type, {...data, toggle: true})).toEqual([
    ['tracked', 'Field is required']
  ])
})

test('fields the policy hides or locks are ignored', () => {
  const Page = Config.type('Page', {
    fields: {
      title: Field.text('Title', {required: true}),
      secret: Field.text('Secret', {required: true}),
      locked: Field.text('Locked', {required: true})
    }
  })
  const config = createConfig({
    schema: {Page},
    workspaces: {
      main: Config.workspace('Main', {
        source: 'content',
        roots: {pages: Config.root('Pages')}
      })
    }
  })
  const policy = new WriteablePolicy(getScope(config))
  policy.set({type: Page, allow: {read: true, update: true}})
  policy.set({field: Page.secret, deny: {read: true}})
  policy.set({field: Page.locked, deny: {update: true}})
  const fieldOptions = policyFieldOptions(config, policy, {type: 'Page'})
  expect(
    validateEntry(Page, {}, {fieldOptions}).map(error =>
      formatFieldPath(error.path)
    )
  ).toEqual(['title'])
})
