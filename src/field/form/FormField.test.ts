import {Field as CoreField} from '#/core/Field.js'
import {formatFieldPath, validateEntry} from '#/core/Validation.js'
import {Config, Field, Form} from '#/index.js'
import {expect, test} from 'bun:test'

const Rating = Form.input('Rating', {
  settings: {max: Field.number('Maximum', {initialValue: 5})},
  parse: ([raw]) => (raw ? Number(raw) : undefined),
  attributes: settings => ({min: 1, max: settings.max ?? undefined}),
  validate: (value, settings) =>
    value < 1 || value > (settings.max ?? 5)
      ? `Choose 1 to ${settings.max}`
      : undefined
})

const inputs = Field.form('Inputs', {
  inputs: {...Form.defaults, rating: Rating}
})

const Contact = Config.type('Contact', {fields: {inputs}})

const rows: Array<Record<string, unknown>> = [
  {
    _id: 'about',
    _index: 'a0',
    _type: 'section',
    label: 'About you',
    help: '',
    inputs: [
      {
        _id: 'name',
        _index: 'a0',
        _type: 'text',
        label: 'Your name',
        required: true,
        placeholder: '',
        maxLength: 80
      },
      {
        _id: 'mail',
        _index: 'a1',
        _type: 'email',
        label: 'Email',
        key: 'address',
        width: 'half'
      }
    ]
  },
  {
    _id: 'service',
    _index: 'a1',
    _type: 'radio',
    label: 'Service',
    options: [
      {_id: 'it', _index: 'a0', _type: 'option', label: 'IT'},
      {_id: 'hr', _index: 'a1', _type: 'option', label: 'HR', value: 'people'}
    ]
  },
  {_id: 'rate', _index: 'a2', _type: 'rating', label: 'Rate us', max: 10}
]

test('inputs are the row types of the field', () => {
  const {schema} = CoreField.options(inputs)
  expect(Object.keys(schema)).toEqual([...Object.keys(Form.defaults), 'rating'])
})

test('the definition names inputs by their key', async () => {
  const definition = await CoreField.queryValue(
    inputs,
    structuredClone(rows),
    undefined!
  )
  expect(definition).toEqual([
    {
      id: 'about',
      type: 'section',
      label: 'About you',
      control: 'section',
      inputs: [
        {
          id: 'name',
          type: 'text',
          label: 'Your name',
          control: 'input',
          key: 'your-name',
          required: true,
          width: 'full',
          attributes: {type: 'text', maxLength: 80},
          settings: {maxLength: 80}
        },
        {
          id: 'mail',
          type: 'email',
          label: 'Email',
          control: 'input',
          key: 'address',
          required: false,
          width: 'half',
          attributes: {type: 'email', autoComplete: 'email'},
          settings: {}
        }
      ]
    },
    {
      id: 'service',
      type: 'radio',
      label: 'Service',
      control: 'radio',
      key: 'service',
      required: false,
      width: 'full',
      attributes: {},
      settings: {},
      choices: [
        {id: 'it', label: 'IT', value: 'it'},
        {id: 'hr', label: 'HR', value: 'people'}
      ]
    },
    {
      id: 'rate',
      type: 'rating',
      label: 'Rate us',
      control: 'input',
      key: 'rate-us',
      required: false,
      width: 'full',
      attributes: {min: 1, max: 10},
      settings: {max: 10}
    }
  ])
})

test('keys are unique across sections', () => {
  const duplicate = structuredClone(rows)
  duplicate[2].key = 'address'
  const errors = validateEntry(Contact, {inputs: duplicate}).map(error => [
    formatFieldPath(error.path),
    error.message
  ])
  expect(errors).toEqual([
    ['inputs[2].key', 'Another input uses the key "address"']
  ])
})

test('an input needs a label', () => {
  const errors = validateEntry(Contact, {
    inputs: [{_id: 'x', _index: 'a0', _type: 'text', label: ''}]
  }).map(error => formatFieldPath(error.path))
  expect(errors).toEqual(['inputs[0].label'])
})

test('default inputs validate their values', () => {
  const settings = {placeholder: '', maxLength: 3, initialValue: ''}
  expect(Form.text.validate?.('abcd', settings)).toBe(
    'Use at most 3 characters'
  )
  expect(Form.email.validate?.('a@b.be', {placeholder: ''})).toBeUndefined()
  expect(Form.email.validate?.('a@b', {placeholder: ''})).toBe(
    'Use a valid email address'
  )
  const options = [
    {_id: 'a', _index: 'a0', _type: 'option' as const, label: 'A', value: 'a'}
  ]
  expect(Form.radio.validate?.('a', {options})).toBeUndefined()
  expect(Form.checkboxes.validate?.(['a', 'b'], {options})).toBe(
    'Choose a listed option'
  )
  expect(Form.number.parse?.(['4'], {} as any)).toBe(4)
})

test('saving fixes keys and option values', () => {
  const saved = CoreField.beforeSave(inputs, rows as any, {
    action: 'update',
    now: new Date()
  })
  const [about, service] = saved as Array<any>
  expect(about.inputs.map((row: any) => row.key)).toEqual([
    'your-name',
    'address'
  ])
  expect(service.key).toBe('service')
  expect(service.options.map((option: any) => option.value)).toEqual([
    'it',
    'people'
  ])
})

test('options of an input have their own value', () => {
  const errors = validateEntry(Contact, {
    inputs: [
      {
        _id: 'pick',
        _index: 'a0',
        _type: 'select',
        label: 'Pick',
        options: [
          {_id: 'a', _index: 'a0', _type: 'option', label: 'IT'},
          {_id: 'b', _index: 'a1', _type: 'option', label: 'I.T.', value: 'it'}
        ]
      }
    ]
  }).map(error => [formatFieldPath(error.path), error.message])
  expect(errors).toEqual([
    ['inputs[0].options[1].value', 'Another option uses the value "it"']
  ])
})
