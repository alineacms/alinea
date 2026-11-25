import {createCMS} from '#/core.js'
import {Config, Field, Form} from '#/index.js'
import {Type} from '#/core/Type.js'
import {expect, test} from 'bun:test'

test('form types take tabs of their own after the Form tab', () => {
  const FormPage = Form.type('Form page', {
    inputs: Form.defaults,
    tabs: {
      page: Field.tab('Page', {fields: {intro: Field.richText('Intro')}})
    }
  })
  const fields = Object.keys(Type.fields(FormPage))
  expect(fields).toContain('intro')
  expect(fields.indexOf('intro')).toBeGreaterThan(fields.indexOf('inputs'))
  expect(fields.indexOf('intro')).toBeLessThan(fields.indexOf('mails'))
})

test('an entry holds one form', () => {
  const Survey = Config.document('Survey', {
    fields: {
      before: Field.form('Before', {inputs: Form.defaults}),
      after: Field.form('After', {inputs: Form.defaults})
    }
  })
  const pages = Config.root('Pages')
  expect(() =>
    createCMS({
      schema: {Survey},
      workspaces: {
        main: Config.workspace('Main', {source: 'content', roots: {pages}})
      }
    })
  ).toThrow(
    'Type "Survey" has more than one Field.form (before, after), an entry holds one form'
  )
})
