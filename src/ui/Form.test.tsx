import {cleanup, fireEvent, render, screen, within} from '#test/react.js'
import type {FormDefinition} from '#/field/form/FormDefinition.js'
import {afterEach, expect, test} from 'bun:test'
import {
  Form,
  type FormContentViewProps,
  type FormInputViewProps
} from './Form.js'

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
        help: [
          {
            _type: 'paragraph',
            content: [{_type: 'text', text: 'As on your id'}]
          }
        ],
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

test('labels can show as placeholders of text inputs', () => {
  render(
    <Form aria-label="Contact" definition={definition} placeholderLabels />
  )
  // The label is still read, it is out of sight
  const name = screen.getByRole('textbox', {name: 'Name *'})
  expect(name.getAttribute('placeholder')).toBe('Name *')
  const label = screen.getByText('Name').closest('label')!
  expect(label.style.position).toBe('absolute')
  // Choices keep their label in sight
  const service = screen.getByRole('group', {name: 'Service *'})
  expect(service.querySelector('legend')!.hasAttribute('style')).toBe(false)
})

test('views restyle parts and replace inputs', () => {
  render(
    <Form
      definition={definition}
      errors={{name: 'Fill in your name'}}
      views={{
        control: <input className="input" />,
        choiceControl: <input className="choice" />,
        submit: <button className="button">Request</button>,
        rating: Rating
      }}
    />
  )
  const name = screen.getByRole('textbox', {name: 'Name *'})
  expect(name.className).toBe('input')
  for (const radio of screen.getAllByRole('radio'))
    expect(radio.className).toBe('choice')
  expect(name.getAttribute('aria-invalid')).toBe('true')
  expect(screen.getByRole('alert').textContent).toBe('Fill in your name')
  expect(screen.getByRole('button').textContent).toBe('Request')
  expect(screen.getByRole('status').textContent).toBe('Rate us out of 5')
})

const signUp: FormDefinition = [
  {
    id: 'people',
    type: 'section',
    label: 'Participant',
    control: 'section',
    key: 'participants',
    repeat: {min: 1, max: 2, add: 'Add a participant'},
    inputs: [
      {
        id: 'person',
        type: 'text',
        label: 'Name',
        control: 'input',
        key: 'name',
        required: true,
        width: 'full',
        attributes: {type: 'text'},
        settings: {}
      }
    ]
  }
]

test('repeatable sections add and remove items', () => {
  render(
    <Form
      definition={signUp}
      errors={{'participants.1.name': 'Fill in this field'}}
    />
  )
  const names = () =>
    screen
      .getAllByRole('textbox', {name: 'Name *'})
      .map(input => input.getAttribute('name'))
  expect(names()).toEqual(['participants.0.name'])
  // The fewest items can not be removed
  expect(screen.queryByRole('button', {name: /Remove/})).toBeNull()
  fireEvent.click(screen.getByRole('button', {name: 'Add a participant'}))
  expect(names()).toEqual(['participants.0.name', 'participants.1.name'])
  expect(screen.getByRole('group', {name: 'Participant 2'})).toBeDefined()
  expect(screen.getByRole('alert').textContent).toBe('Fill in this field')
  // At the most items there is no button to add another
  expect(screen.queryByRole('button', {name: 'Add a participant'})).toBeNull()
  const first = screen.getAllByRole('textbox')[0] as HTMLInputElement
  first.value = 'Ann'
  fireEvent.click(screen.getByRole('button', {name: 'Remove Participant 1'}))
  // The item that was second moves up and takes the first name
  expect(names()).toEqual(['participants.0.name'])
  expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('')
})

test('a hidden input takes its parameter before the rules see it', () => {
  const {happyDOM} = window as unknown as {
    happyDOM: {setURL(url: string): void}
  }
  happyDOM.setURL('http://localhost/?utm=spring')
  const campaign: FormDefinition = [
    {
      id: 'c',
      type: 'hidden',
      label: 'Campaign',
      control: 'input',
      key: 'campaign',
      required: false,
      width: 'full',
      attributes: {type: 'hidden'},
      settings: {param: 'utm'}
    },
    {
      id: 'p',
      type: 'text',
      label: 'Promo',
      control: 'input',
      key: 'promo',
      required: true,
      width: 'full',
      attributes: {type: 'text'},
      settings: {},
      showWhen: {
        match: 'all',
        rules: [{input: 'campaign', op: 'is', value: 'spring'}]
      }
    }
  ]
  try {
    const {container} = render(
      <Form action={async () => ({ok: true})} definition={campaign} />
    )
    expect(container.querySelector('[name=promo]')).not.toBeNull()
    const hidden = container.querySelector<HTMLInputElement>('[name=campaign]')
    expect(hidden?.value).toBe('spring')
  } finally {
    happyDOM.setURL('about:blank')
  }
})

test('rules on the language test the language the form was queried in', () => {
  const dutch: FormDefinition = [
    {
      id: 'vat',
      type: 'text',
      label: 'VAT',
      control: 'input',
      key: 'vat',
      required: false,
      width: 'full',
      attributes: {type: 'text'},
      settings: {},
      showWhen: {
        match: 'all',
        rules: [{input: '@locale', op: 'is', value: ['nl'], locale: 'nl'}]
      }
    }
  ]
  const shown = (locale?: string) => {
    const {container} = render(<Form definition={dutch} locale={locale} />)
    const found = container.querySelector('[name=vat]') !== null
    cleanup()
    return found
  }
  expect(shown()).toBe(true)
  expect(shown('en')).toBe(false)
})

test('labels replace the texts of the form', () => {
  render(
    <Form
      definition={signUp}
      labels={{submit: 'Verzenden', remove: 'Verwijder'}}
    />
  )
  expect(screen.getByRole('button', {name: 'Verzenden'})).toBeDefined()
  fireEvent.click(screen.getByRole('button', {name: 'Add a participant'}))
  expect(
    screen.getByRole('button', {name: 'Verwijder Participant 2'}).textContent
  ).toBe('Verwijder')
})

test('text between inputs renders as rich text', () => {
  render(
    <Form
      definition={[
        {
          id: 'note',
          type: 'content',
          label: 'Privacy',
          control: 'content',
          data: {
            body: [
              {
                _type: 'paragraph',
                content: [
                  {_type: 'text', text: 'Mail '},
                  {
                    _type: 'text',
                    text: 'us',
                    marks: [
                      {
                        _type: 'link',
                        _id: 'l',
                        _link: 'url',
                        href: 'mailto:help@example.com'
                      }
                    ]
                  }
                ]
              }
            ]
          }
        }
      ]}
      views={{content: <div className="note" />}}
    />
  )
  const link = screen.getByRole('link', {name: 'us'})
  expect(link.getAttribute('href')).toBe('mailto:help@example.com')
  expect(link.closest('[data-content]')?.className).toBe('note')
})

function linked(text: string, href: string) {
  return [
    {
      _type: 'paragraph',
      content: [
        {_type: 'text', text: 'I agree to the '},
        {
          _type: 'text',
          text,
          marks: [{_type: 'link', _id: 'l', _link: 'url', href}]
        }
      ]
    }
  ]
}

test('help and the text of a check render as rich text', () => {
  const check = {
    type: 'check',
    control: 'check',
    required: true,
    width: 'full',
    attributes: {}
  } as const
  render(
    <Form
      definition={[
        {
          ...check,
          id: 'terms',
          key: 'terms',
          label: 'Terms',
          settings: {text: linked('terms', '/terms')},
          help: linked('rules', '/rules')
        },
        {...check, id: 'news', key: 'news', label: 'Newsletter', settings: {}}
      ]}
    />
  )
  const terms = screen.getByRole('checkbox', {name: 'I agree to the terms *'})
  expect(terms.getAttribute('aria-describedby')).toBe('form-terms-help')
  expect(screen.getByRole('link', {name: 'terms'}).getAttribute('href')).toBe(
    '/terms'
  )
  const help = screen.getByRole('link', {name: 'rules'})
  expect(help.closest('#form-terms-help')).not.toBeNull()
  expect(screen.getByRole('checkbox', {name: 'Newsletter *'})).toBeDefined()
})

test('content renders with the view of its type', () => {
  function Notice({content}: FormContentViewProps) {
    return <aside>{String(content.data.title)}</aside>
  }
  render(
    <Form
      definition={[
        {
          id: 'notice',
          type: 'notice',
          label: '',
          control: 'content',
          data: {title: 'Closed on Mondays'}
        }
      ]}
      views={{notice: Notice}}
    />
  )
  expect(screen.getByRole('complementary').textContent).toBe(
    'Closed on Mondays'
  )
})
