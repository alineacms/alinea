import {Field as CoreField} from '#/core/Field.js'
import {formatFieldPath, validateEntry} from '#/core/Validation.js'
import {Config, Field, Form} from '#/index.js'
import {expect, test} from 'bun:test'
import type {FormDefinition} from './FormDefinition.js'
import {formState, matches} from './FormConditions.js'

const inputs = Field.form('Inputs', {inputs: Form.defaults})
const Request = Config.type('Request', {fields: {inputs}})

const options = [
  {_id: 'it', _index: 'a0', _type: 'option', label: 'IT'},
  {_id: 'fac', _index: 'a1', _type: 'option', label: 'Facilities'}
]

const rows = [
  {_id: 'service', _index: 'a0', _type: 'radio', label: 'Service', options},
  {
    _id: 'device',
    _index: 'a1',
    _type: 'text',
    label: 'Device',
    showWhen: {
      match: 'all',
      rules: [{id: 'r1', input: 'service', op: 'is', value: ['it']}]
    }
  },
  {
    _id: 'more',
    _index: 'a2',
    _type: 'section',
    label: 'More',
    showWhen: {
      match: 'any',
      rules: [{id: 'r2', input: 'device', op: 'filled'}]
    },
    inputs: [
      {
        _id: 'room',
        _index: 'a0',
        _type: 'number',
        label: 'Room',
        disableWhen: {
          match: 'all',
          rules: [{id: 'r3', input: 'device', op: 'contains', value: 'lap'}]
        }
      }
    ]
  }
]

async function definition(rows: unknown) {
  return (await CoreField.queryValue(
    inputs,
    structuredClone(rows) as any,
    undefined!
  )) as FormDefinition
}

test('rules reach the site by key and option value', async () => {
  const [, device, more] = await definition(rows)
  expect(device.showWhen).toEqual({
    match: 'all',
    rules: [{input: 'service', op: 'is', value: ['it']}]
  })
  expect(more.showWhen?.rules).toEqual([{input: 'device', op: 'filled'}])
})

test('hidden and disabled follow the answers above them', async () => {
  const form = await definition(rows)
  const state = (values: Record<string, unknown>) => {
    const {hidden, disabled} = formState(form, values)
    return {hidden: [...hidden], disabled: [...disabled]}
  }
  expect(state({})).toEqual({hidden: ['device', 'more', 'room'], disabled: []})
  expect(state({service: 'it', device: 'Laptop'})).toEqual({
    hidden: [],
    disabled: ['room']
  })
  // A hidden input counts as empty for the rules below it
  expect(state({service: 'fac', device: 'Laptop'})).toEqual({
    hidden: ['device', 'more', 'room'],
    disabled: []
  })
})

test('operators compare answers', () => {
  expect(matches({input: 'a', op: 'lt', value: 3}, '2')).toBe(true)
  expect(
    matches({input: 'a', op: 'gt', value: '2026-01-01'}, '2025-12-31')
  ).toBe(false)
  expect(matches({input: 'a', op: 'includes', value: ['x']}, ['y', 'x'])).toBe(
    true
  )
  expect(matches({input: 'a', op: 'excludes', value: ['x']}, [])).toBe(true)
  expect(matches({input: 'a', op: 'checked'}, true)).toBe(true)
  expect(matches({input: 'a', op: 'unchecked'}, undefined)).toBe(true)
  expect(matches({input: 'a', op: 'is', value: 'Yes'}, ' yes ')).toBe(true)
})

test('broken rules are validation errors', async () => {
  const broken = structuredClone(rows) as Array<any>
  // Service loses the option the rule of Device looks for
  broken[0].options = options.slice(1)
  // Room's rule moves below Room by using an input after it
  broken[2].inputs[0].disableWhen.rules[0].input = 'later'
  broken.push({_id: 'later', _index: 'a3', _type: 'text', label: 'Later'})
  const errors = validateEntry(Request, {inputs: broken}).map(error => [
    formatFieldPath(error.path),
    error.message
  ])
  expect(errors).toEqual([
    [
      'inputs[1].showWhen',
      'Its rule uses an option of Service that was removed'
    ],
    [
      'inputs[2].inputs[0].disableWhen',
      'Its rule uses Later, which is below it'
    ]
  ])
  // The site only gets the rules that work
  const [, device] = await definition(broken)
  expect(device.showWhen).toBeUndefined()
})
