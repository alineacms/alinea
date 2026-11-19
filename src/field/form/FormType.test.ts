import {Field, Form} from '#/index.js'
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
