import {createCMS, Entry} from '#/core.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import {EntryStore} from '#/database/EntryStore.js'
import {Config, Form} from '#/index.js'
import {expect, test} from 'bun:test'
import {shareForm} from './FormShare.js'

const option = (id: string, label: string) => ({
  _id: id,
  _index: 'a0',
  _type: 'option',
  label,
  value: id
})

const english = [
  {
    _id: 'name',
    _index: 'a0',
    _type: 'text',
    label: 'Name',
    key: 'name',
    required: true,
    placeholder: 'Your name',
    maxLength: 80
  },
  {
    _id: 'room',
    _index: 'a1',
    _type: 'radio',
    label: 'Room',
    key: 'room',
    options: [option('yes', 'Yes')]
  }
]

const dutch = [
  {...english[0], label: 'Naam', placeholder: 'Je naam'},
  {...english[1], label: 'Kot', options: [option('yes', 'Ja')]}
]

test('a shared form keeps the texts of the other language', () => {
  const changed = [
    {...english[1], options: [option('yes', 'Yes'), option('no', 'No')]},
    {...english[0], maxLength: 40},
    {_id: 'mail', _index: 'a2', _type: 'email', label: 'Email', key: 'email'}
  ]
  expect(shareForm(Form.defaults, changed, dutch)).toEqual([
    {
      _id: 'room',
      _index: 'a1',
      _type: 'radio',
      key: 'room',
      label: 'Kot',
      // A new option has no label in Dutch yet
      options: [option('yes', 'Ja'), {...option('no', 'No'), label: undefined}]
    },
    {
      _id: 'name',
      _index: 'a0',
      _type: 'text',
      key: 'name',
      required: true,
      maxLength: 40,
      label: 'Naam',
      placeholder: 'Je naam'
    },
    // A new input has no texts in Dutch yet
    {_id: 'mail', _index: 'a2', _type: 'email', key: 'email'}
  ])
})

test('saving a shared form writes its structure into the other languages', async () => {
  const FormEntry = Form.type('Form', {inputs: Form.defaults, shared: true})
  const cms = createCMS({
    schema: {FormEntry},
    workspaces: {
      main: Config.workspace('Main', {
        source: 'content',
        roots: {
          forms: Config.root('Forms', {
            contains: ['FormEntry'],
            i18n: {locales: ['en', 'nl']}
          })
        }
      })
    }
  })
  const db = await EntryStore.memory(cms.config, new MemorySource())
  await db.sync()
  const base = {type: 'FormEntry', workspace: 'main', root: 'forms'}
  await db.mutate([
    {
      op: 'create',
      id: 'form',
      locale: 'en',
      ...base,
      data: {title: 'Sign up', path: 'sign-up', inputs: english}
    }
  ])
  await db.mutate([
    {
      op: 'create',
      id: 'form',
      locale: 'nl',
      ...base,
      data: {title: 'Inschrijven', path: 'inschrijven', inputs: dutch}
    }
  ])
  await db.mutate([
    {
      op: 'update',
      id: 'form',
      locale: 'en',
      status: 'published',
      set: {
        inputs: [
          ...english,
          {
            _id: 'mail',
            _index: 'a2',
            _type: 'email',
            label: 'Email',
            key: 'email'
          }
        ]
      }
    }
  ])
  const inputs = (await db.first({
    id: 'form',
    locale: 'nl',
    select: Entry.data
  })) as {inputs: Array<Record<string, unknown>>}
  expect(inputs.inputs.map(row => [row._id, row.label])).toEqual([
    ['name', 'Naam'],
    ['room', 'Kot'],
    ['mail', undefined]
  ])
})
