import {cleanup, render, screen, within} from '#test/react.js'
import type {FormDefinition} from '#/field/form/FormDefinition.js'
import {afterEach, expect, test} from 'bun:test'
import {Form, type FormInputViewProps} from './Form.js'

afterEach(cleanup)

const definition: FormDefinition = [
  {
    id: 'about',
    type: 'section',
    label: 'About you',
    control: 'section',
    inputs: [
      {
        id: 'name',
        type: 'text',
        label: 'Name',
        help: 'As on your id',
        control: 'input',
        key: 'name',
        required: true,
        width: 'half',
        attributes: {type: 'text', maxLength: 80},
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
    required: true,
    width: 'full',
    attributes: {},
    settings: {},
    choices: [
      {id: 'it', label: 'IT', value: 'it'},
      {id: 'hr', label: 'HR', value: 'hr'}
    ]
  },
  {
    id: 'rate',
    type: 'rating',
    label: 'Rate us',
    control: 'input',
    key: 'rate',
    required: false,
    width: 'full',
    attributes: {},
    settings: {max: 5}
  }
]

function Rating({input, id}: FormInputViewProps) {
  return (
    <output id={id}>{`${input.label} out of ${input.settings.max}`}</output>
  )
}

test('renders inputs with their label, help and constraints', () => {
  render(<Form aria-label="Contact" definition={definition} />)
  const name = screen.getByRole('textbox', {name: 'Name *'})
  expect(name.getAttribute('name')).toBe('name')
  expect(name.getAttribute('maxlength')).toBe('80')
  expect(name.hasAttribute('required')).toBe(true)
  expect(name.getAttribute('aria-describedby')).toBe('form-name-help')
  expect(screen.getByRole('group', {name: 'About you'})).toBeDefined()
  const service = screen.getByRole('group', {name: 'Service *'})
  expect(
    within(service)
      .getAllByRole('radio')
      .map(radio => radio.getAttribute('value'))
  ).toEqual(['it', 'hr'])
})

test('views restyle parts and replace inputs', () => {
  render(
    <Form
      definition={definition}
      errors={{name: 'Fill in your name'}}
      views={{
        control: <input className="input" />,
        submit: <button className="button">Request</button>,
        rating: Rating
      }}
    />
  )
  const name = screen.getByRole('textbox', {name: 'Name *'})
  expect(name.className).toBe('input')
  expect(name.getAttribute('aria-invalid')).toBe('true')
  expect(screen.getByRole('alert').textContent).toBe('Fill in your name')
  expect(screen.getByRole('button').textContent).toBe('Request')
  expect(screen.getByRole('status').textContent).toBe('Rate us out of 5')
})
