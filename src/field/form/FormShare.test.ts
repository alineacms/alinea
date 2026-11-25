import {createCMS, Entry} from '#/core.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import {EntryStore} from '#/database/EntryStore.js'
import {Config, Form} from '#/index.js'
import {expect, test} from 'bun:test'
import {fillForm, shareForm} from './FormShare.js'

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

const mail = {_id: 'mail', _index: 'a2', _type: 'email', key: 'email'}

test('texts not translated yet fall back to another language', () => {
  const rows = [
    {...dutch[0], placeholder: ''},
    {
      ...dutch[1],
      options: [option('yes', 'Ja'), {...option('no', 'No'), label: undefined}]
    },
    mail
  ]
  const theirs = [
    english[0],
    {...english[1], options: [option('yes', 'Yes'), option('no', 'No')]},
    {...mail, label: 'Email'}
  ]
  const filled = fillForm(Form.defaults, rows, [theirs]) as Array<{
    label: string
    placeholder?: string
    options?: Array<{label: string}>
  }>
  expect(filled.map(row => row.label)).toEqual(['Naam', 'Kot', 'Email'])
  expect(filled[0].placeholder).toBe('Your name')
  expect(filled[1].options!.map(option => option.label)).toEqual(['Ja', 'No'])
})

async function translatedForm(
  i18n: {locales: Array<string>; fallback?: (locale: string) => Array<string>},
  versions: Record<string, Array<Record<string, unknown>>>
) {
  const FormEntry = Form.type('Form', {inputs: Form.defaults, shared: true})
  const cms = createCMS({
    schema: {FormEntry},
    workspaces: {
      main: Config.workspace('Main', {
        source: 'content',
        roots: {forms: Config.root('Forms', {contains: ['FormEntry'], i18n})}
      })
    }
  })
  const db = await EntryStore.memory(cms.config, new MemorySource())
  await db.sync()
  for (const [locale, inputs] of Object.entries(versions))
    await db.mutate([
      {
        op: 'create',
        id: 'form',
        locale,
        type: 'FormEntry',
        workspace: 'main',
        root: 'forms',
        data: {title: 'Form', path: `form-${locale}`, inputs}
      }
    ])
  return async (locale: string) => {
    const inputs = await db.first({
      id: 'form',
      locale,
      select: FormEntry.inputs
    })
    return inputs!.map(item => item.label)
  }
}

test('a shared form shows the texts of the default language', async () => {
  const labels = await translatedForm(
    {locales: ['en', 'nl']},
    {en: [...english, {...mail, label: 'Email'}], nl: [...dutch, mail]}
  )
  expect(await labels('nl')).toEqual(['Naam', 'Kot', 'Email'])
  expect(await labels('en')).toEqual(['Name', 'Room', 'Email'])
})

test('a shared form follows the fallback of its root', async () => {
  const versions = {
    en: [...english, {...mail, label: 'Email'}],
    nl: [...dutch, {...mail, label: 'E-mail'}],
    'nl-BE': [english[0], english[1], mail].map(row => ({...row, label: ''}))
  }
  const plain = await translatedForm({locales: ['en', 'nl', 'nl-BE']}, versions)
  expect(await plain('nl-BE')).toEqual(['Name', 'Room', 'Email'])
  const flemish = await translatedForm(
    {locales: ['en', 'nl', 'nl-BE'], fallback: () => ['nl']},
    versions
  )
  expect(await flemish('nl-BE')).toEqual(['Naam', 'Kot', 'E-mail'])
})
