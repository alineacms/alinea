import {Field, Form} from '#/index.js'
import {expect, test} from 'bun:test'
import {answerGroups, formColumns, formInputs} from './FormAnswers.js'
import {formDefinition, formErrors} from './FormDefinition.js'
import {validateSubmission} from './FormSubmission.js'

const inputs = Field.form('Inputs', {inputs: Form.defaults})

const body = [
  {
    _type: 'paragraph',
    content: [{_type: 'text', text: 'Your answers are kept for a year.'}]
  }
]

const rows = [
  {_id: 'name', _index: 'a0', _type: 'text', label: 'Name', required: true},
  {_id: 'note', _index: 'a1', _type: 'content', label: 'Privacy', body},
  {
    _id: 'address',
    _index: 'a2',
    _type: 'section',
    label: 'Address',
    inputs: [
      {_id: 'intro', _index: 'a0', _type: 'content', body},
      {_id: 'street', _index: 'a1', _type: 'text', label: 'Street'}
    ]
  }
]

test('text between inputs is in the definition with its body', () => {
  const definition = formDefinition(Form.defaults, rows)
  expect(definition[1]).toEqual({
    id: 'note',
    type: 'content',
    label: 'Privacy',
    control: 'content',
    data: {body}
  })
  const section = definition[2]
  if (section.control !== 'section') throw new Error('Expected a section')
  expect(section.inputs.map(item => item.control)).toEqual(['content', 'input'])
})

test('text has no answer, key or column', () => {
  const definition = formDefinition(Form.defaults, rows)
  expect(formInputs(definition).map(input => input.key)).toEqual([
    'name',
    'street'
  ])
  expect(formColumns(definition).map(column => column.id)).toEqual([
    'name',
    'street'
  ])
  const groups = answerGroups(definition, {name: 'Ann'})
  expect(groups.flatMap(group => group.answers.map(a => a.input.id))).toEqual([
    'name',
    'street'
  ])
  // Two texts without a name do not share a key
  expect(formErrors(Form.defaults, rows, [], [])).toEqual([])
})

test('a submission skips text', () => {
  const data = new FormData()
  data.set('name', 'Ann')
  data.set('street', 'Main street')
  const result = validateSubmission(inputs, rows, data)
  expect(result.ok && result.values).toEqual({
    name: 'Ann',
    street: 'Main street'
  })
})

test('content of your own holds its fields and settings', () => {
  const notice = Form.content('Notice', {
    fields: {title: Field.text('Title')},
    settings: {tone: Field.select('Tone', {options: {info: 'Info'}})}
  })
  const own = {...Form.defaults, notice}
  const definition = formDefinition(own, [
    {_id: 'n', _index: 'a0', _type: 'notice', title: 'Closed', tone: 'info'}
  ])
  expect(definition).toEqual([
    {
      id: 'n',
      type: 'notice',
      label: '',
      control: 'content',
      data: {title: 'Closed', tone: 'info'}
    }
  ])
  const form = Field.form('Inputs', {inputs: own})
  const data = new FormData()
  const result = validateSubmission(
    form,
    [{_id: 'n', _index: 'a0', _type: 'notice'}],
    data
  )
  expect(result.ok && result.values).toEqual({})
})
