import type {Submission} from '#/core/Connection.js'
import {Field as CoreField} from '#/core/Field.js'
import {Field, Form} from '#/index.js'
import {expect, test} from 'bun:test'
import {answerGroups, submissionsCsv} from './FormAnswers.js'
import {formState} from './FormConditions.js'
import {formDefinition, formErrors, itemIndexes} from './FormDefinition.js'
import {formMails} from './FormMails.js'
import {readingOrder, ruleErrors} from './FormRules.js'
import {validateSubmission} from './FormSubmission.js'

const field = Field.form('Inputs', {inputs: Form.defaults})
const {inputs} = CoreField.options(field)

const rule = (input: string, op: string, value?: unknown) => ({
  match: 'all',
  rules: [{id: `${input}-${op}`, input, op, value}]
})

// A sign-up for one or more people, with a diet when they stay for lunch
const rows = [
  {_id: 'contact', _index: 'a0', _type: 'email', label: 'Contact'},
  {
    _id: 'people',
    _index: 'a1',
    _type: 'section',
    label: 'Participant',
    repeat: true,
    key: 'participants',
    min: 1,
    max: 3,
    add: 'Add a participant',
    inputs: [
      {
        _id: 'name',
        _index: 'a0',
        _type: 'text',
        label: 'Name',
        required: true
      },
      {_id: 'lunch', _index: 'a1', _type: 'check', label: 'Lunch'},
      {
        _id: 'diet',
        _index: 'a2',
        _type: 'text',
        label: 'Diet',
        required: true,
        showWhen: rule('lunch', 'checked')
      }
    ]
  },
  {_id: 'notes', _index: 'a2', _type: 'textarea', label: 'Notes'}
]

function data(entries: Array<[string, string]>) {
  const result = new FormData()
  for (const [key, value] of entries) result.append(key, value)
  return result
}

test('a repeatable section has a key and its repeat settings', () => {
  const [, section] = formDefinition(inputs, rows)
  expect(section).toMatchObject({
    control: 'section',
    key: 'participants',
    repeat: {min: 1, max: 3, add: 'Add a participant'}
  })
  // The rule within the item points at the key of the input
  expect(section.control === 'section' && section.inputs[2].showWhen).toEqual({
    match: 'all',
    rules: [{input: 'lunch', op: 'checked'}]
  })
})

test('a repeatable section needs a key of its own and a sensible maximum', () => {
  const errors = formErrors(
    inputs,
    [
      {...rows[0], key: 'participants'},
      {...rows[1], min: 3, max: 2}
    ],
    [],
    []
  )
  expect(errors.map(error => error.message)).toEqual([
    'Allow at least as many items as the fewest',
    'Another input uses the key "participants"'
  ])
})

test('rules can only use inputs of a repeatable section within it', () => {
  const outside = {
    ...rows[2],
    showWhen: rule('lunch', 'checked')
  }
  const errors = ruleErrors(readingOrder(inputs, [rows[0], rows[1], outside]))
  expect(errors).toMatchObject([
    {path: [2, 'showWhen'], message: 'Its rule uses Lunch, which repeats'}
  ])
  // The rule of Diet on Lunch, in the same item, is fine
  expect(ruleErrors(readingOrder(inputs, rows))).toEqual([])
})

test('item names are read in order, also without answers', () => {
  const posted = data([
    ['participants.1', ''],
    ['participants.0', ''],
    ['participants.0.name', 'Ann'],
    ['participants.10.name', 'Bo']
  ])
  expect(itemIndexes('participants', posted)).toEqual([0, 1, 10])
})

test('each item is checked on its own, with the rules of its item', () => {
  const result = validateSubmission(
    field,
    rows,
    data([
      ['contact', 'ann@example.com'],
      ['participants.0', ''],
      ['participants.0.name', 'Ann'],
      ['participants.0.lunch', 'on'],
      ['participants.0.diet', 'Vegan'],
      ['participants.1', ''],
      ['participants.1.name', 'Bo'],
      // Bo does not stay for lunch, the diet is hidden and left out
      ['participants.1.diet', 'Ignored']
    ])
  )
  expect(result).toMatchObject({
    ok: true,
    values: {
      contact: 'ann@example.com',
      participants: [{name: 'Ann', lunch: true, diet: 'Vegan'}, {name: 'Bo'}]
    }
  })
})

test('errors point at the input in its item', () => {
  const result = validateSubmission(
    field,
    rows,
    data([
      ['participants.0', ''],
      ['participants.0.name', 'Ann'],
      ['participants.1', ''],
      ['participants.1.lunch', 'on']
    ])
  )
  expect(result).toEqual({
    ok: false,
    errors: {
      'participants.1.name': 'Fill in this field',
      'participants.1.diet': 'Fill in this field'
    }
  })
})

test('the number of items is checked', () => {
  const none = validateSubmission(field, rows, data([]))
  expect(none).toEqual({
    ok: false,
    errors: {participants: 'Add at least 1 item'}
  })
  const many = validateSubmission(
    field,
    rows,
    data(
      [0, 1, 2, 3].map(index => [
        `participants.${index}.name`,
        `Person ${index}`
      ])
    )
  )
  expect(many).toEqual({
    ok: false,
    errors: {participants: 'Add at most 3 items'}
  })
})

test('the state of inputs is kept per item', () => {
  const definition = formDefinition(inputs, rows)
  const {hidden} = formState(definition, {
    participants: [{lunch: true}, {}]
  })
  expect([...hidden]).toEqual(['diet:1'])
})

test('editors see each item as a numbered group, and a column per section', () => {
  const definition = formDefinition(inputs, rows)
  const values = {
    contact: 'ann@example.com',
    participants: [{name: 'Ann', lunch: true, diet: 'Vegan'}, {name: 'Bo'}]
  }
  const groups = answerGroups(definition, values)
  expect(
    groups.map(group => [
      group.title,
      group.answers.map(answer => answer.text || answer.state)
    ])
  ).toEqual([
    [undefined, ['ann@example.com']],
    ['Participant 1', ['Ann', 'Yes', 'Vegan']],
    ['Participant 2', ['Bo', 'empty', 'hidden']],
    [undefined, ['empty']]
  ])
  const submission: Submission = {
    id: 's',
    entryId: 'form',
    locale: null,
    field: 'inputs',
    values,
    definition,
    createdAt: 0,
    status: 'new'
  }
  const [header, row] = submissionsCsv(definition, [submission])
    .slice(1)
    .split('\r\n')
  expect(header).toBe('Received,Status,Language,Page,Contact,Participant,Notes')
  expect(row).toBe(
    '1970-01-01T00:00:00.000Z,new,,,ann@example.com,"1. Ann, Yes, Vegan; 2. Bo",'
  )
})

test('mails fill in every item for the key of the section', () => {
  const [out] = formMails(
    inputs,
    rows,
    [
      {
        _id: 'm',
        _index: 'a0',
        _type: 'mail',
        name: 'Sign-up',
        to: 'address',
        address: 'events@example.com',
        subject: 'New sign-up',
        body: 'Participants: {{participants}}'
      }
    ],
    {participants: [{name: 'Ann'}, {name: 'Bo'}]}
  )
  expect(out.mail.text).toBe('Participants: 1. Ann; 2. Bo')
})
