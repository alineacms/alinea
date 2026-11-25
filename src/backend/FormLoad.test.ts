import {createCMS} from '#/core.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import {EntryStore} from '#/database/EntryStore.js'
import {Config, Form} from '#/index.js'
import {expect, test} from 'bun:test'
import {loadForm} from './FormLoad.js'

const mail = (subject: string, body: string) => ({
  _id: 'mail',
  _index: 'a0',
  _type: 'mail',
  name: 'Office',
  to: 'address',
  address: 'office@example.com',
  subject,
  body
})

test('a shared form loads with the texts of another language', async () => {
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
  const input = {_id: 'name', _index: 'a0', _type: 'text', key: 'name'}
  const versions = {
    en: {inputs: [{...input, label: 'Name'}], mails: [mail('Hello', 'Hi')]},
    nl: {inputs: [{...input, label: ''}], mails: [mail('Hallo', '')]}
  }
  for (const [locale, data] of Object.entries(versions))
    await db.mutate([
      {
        op: 'create',
        id: 'form',
        locale,
        type: 'FormEntry',
        workspace: 'main',
        root: 'forms',
        data: {title: 'Form', path: `form-${locale}`, ...data}
      }
    ])
  const {data, inputs} = await loadForm(cms.config, db, {
    entryId: 'form',
    locale: 'nl'
  })
  expect(inputs.map(input => input.label)).toEqual(['Name'])
  const [sent] = data.mails as Array<{subject: string; body: string}>
  expect([sent.subject, sent.body]).toEqual(['Hallo', 'Hi'])
})
