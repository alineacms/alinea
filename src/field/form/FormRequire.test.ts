import {Field, Form} from '#/index.js'
import {expect, test} from 'bun:test'
import {formState} from './FormConditions.js'
import {formDefinition} from './FormDefinition.js'
import {validateSubmission} from './FormSubmission.js'

const inputs = Field.form('Inputs', {inputs: Form.defaults})

const rows = [
  {
    _id: 'contact',
    _index: 'a0',
    _type: 'radio',
    label: 'Contact me by',
    key: 'contact',
    options: [
      {_id: 'mail', _index: 'a0', _type: 'option', label: 'Mail'},
      {_id: 'phone', _index: 'a1', _type: 'option', label: 'Phone'}
    ]
  },
  {
    _id: 'number',
    _index: 'a1',
    _type: 'tel',
    label: 'Phone',
    requireWhen: {
      match: 'all',
      rules: [{id: 'r', input: 'contact', op: 'is', value: ['phone']}]
    }
  }
]

function data(entries: Record<string, string>) {
  const result = new FormData()
  for (const [key, value] of Object.entries(entries)) result.set(key, value)
  return result
}

test('the rules of an input make it required', () => {
  const definition = formDefinition(Form.defaults, rows)
  expect(formState(definition, {contact: 'phone'}).required).toEqual(
    new Set(['number'])
  )
  expect(formState(definition, {contact: 'mail'}).required).toEqual(new Set())
})

test('an input its rules require must be answered', () => {
  expect(validateSubmission(inputs, rows, data({contact: 'phone'}))).toEqual({
    ok: false,
    errors: {phone: expect.any(String)}
  })
  expect(validateSubmission(inputs, rows, data({contact: 'mail'})).ok).toBe(
    true
  )
})
