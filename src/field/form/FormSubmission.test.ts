import {Field, Form} from '#/index.js'
import {expect, test} from 'bun:test'
import {formSpam, isSpam} from './FormSpam.js'
import {validateSubmission} from './FormSubmission.js'

const inputs = Field.form('Inputs', {inputs: Form.defaults})

const rows = [
  {
    _id: 'name',
    _index: 'a0',
    _type: 'text',
    label: 'Name',
    required: true,
    maxLength: 5
  },
  {_id: 'mail', _index: 'a1', _type: 'email', label: 'Email', required: true},
  {
    _id: 'service',
    _index: 'a2',
    _type: 'radio',
    label: 'Service',
    options: [
      {_id: 'it', _index: 'a0', _type: 'option', label: 'IT'},
      {_id: 'hr', _index: 'a1', _type: 'option', label: 'HR'}
    ]
  },
  {
    _id: 'device',
    _index: 'a3',
    _type: 'text',
    label: 'Device',
    required: true,
    showWhen: {
      match: 'all',
      rules: [{id: 'r', input: 'service', op: 'is', value: ['it']}]
    }
  },
  {_id: 'count', _index: 'a4', _type: 'number', label: 'Count', min: 1},
  {_id: 'terms', _index: 'a5', _type: 'check', label: 'Terms', required: true}
]

function data(entries: Record<string, string | Array<string>>) {
  const result = new FormData()
  for (const [key, value] of Object.entries(entries))
    for (const item of [value].flat()) result.append(key, item)
  return result
}

test('answers are parsed and checked by their input', () => {
  const result = validateSubmission(
    inputs,
    rows,
    data({
      name: ' Ann ',
      email: 'ann@example.com',
      service: 'hr',
      device: 'Ignored, it is hidden',
      count: '3',
      terms: 'on',
      other: 'Not an input'
    })
  )
  expect(result.ok && result.values).toEqual({
    name: 'Ann',
    email: 'ann@example.com',
    service: 'hr',
    count: 3,
    terms: true
  })
})

test('errors are given by key', () => {
  const result = validateSubmission(
    inputs,
    rows,
    data({name: 'Annabel', email: 'ann', service: 'it', count: '0'})
  )
  expect(!result.ok && result.errors).toEqual({
    name: 'Use at most 5 characters',
    email: 'Use a valid email address',
    device: 'Fill in this field',
    count: 'Use 1 or more',
    terms: 'Check this to continue'
  })
})

test('unknown options are rejected', () => {
  const result = validateSubmission(
    inputs,
    rows,
    data({name: 'Ann', email: 'a@b.be', service: 'legal', terms: 'on'})
  )
  expect(!result.ok && result.errors).toEqual({
    service: 'Choose a listed option'
  })
})

test('bots fill in the honeypot or send at once', () => {
  const now = 10_000
  expect(isSpam(data({[formSpam.honeypot]: 'spam'}), now)).toBe(true)
  expect(isSpam(data({[formSpam.shownAt]: String(now - 500)}), now)).toBe(true)
  expect(isSpam(data({[formSpam.shownAt]: String(now - 5000)}), now)).toBe(
    false
  )
  expect(isSpam(data({}), now)).toBe(false)
})
