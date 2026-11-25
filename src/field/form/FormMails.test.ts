import {Field as CoreField} from '#/core/Field.js'
import {Field, Form} from '#/index.js'
import {expect, test} from 'bun:test'
import {formMails} from './FormMails.js'

const inputs = CoreField.options(
  Field.form('Inputs', {inputs: Form.defaults})
).inputs

const rows = [
  {_id: 'name', _index: 'a0', _type: 'text', label: 'Name'},
  {_id: 'mail', _index: 'a1', _type: 'email', label: 'Email'},
  {
    _id: 'service',
    _index: 'a2',
    _type: 'radio',
    label: 'Service',
    options: [
      {_id: 'it', _index: 'a0', _type: 'option', label: 'IT', value: 'it'},
      {_id: 'hr', _index: 'a1', _type: 'option', label: 'HR', value: 'hr'}
    ]
  }
]

const mails = [
  {
    _id: 'helpdesk',
    _index: 'a0',
    _type: 'mail',
    name: 'IT helpdesk',
    to: 'address',
    address: 'it@example.com, desk@example.com',
    replyTo: 'mail',
    sendWhen: {
      match: 'all',
      rules: [{id: 'r', input: 'service', op: 'is', value: ['it']}]
    },
    subject: 'New request from {{name}}',
    body: '{{name}} needs help with {{service}}.{{unknown}}'
  },
  {
    _id: 'confirm',
    _index: 'a1',
    _type: 'mail',
    name: 'Confirmation',
    to: 'input',
    input: 'mail',
    subject: 'We received your request',
    body: 'Thanks {{ name }}!'
  },
  {
    _id: 'broken',
    _index: 'a2',
    _type: 'mail',
    name: 'Broken',
    to: 'address',
    address: 'all@example.com',
    sendWhen: {
      match: 'all',
      rules: [{id: 'r', input: 'removed', op: 'filled'}]
    },
    subject: 'Never sent',
    body: ''
  }
]

const values = {name: 'Ann', email: 'ann@example.com', service: 'it'}

test('mails whose rules hold are sent with the answers filled in', () => {
  expect(formMails(inputs, rows, mails, values)).toEqual([
    {
      name: 'IT helpdesk',
      mail: {
        to: ['it@example.com', 'desk@example.com'],
        replyTo: 'ann@example.com',
        subject: 'New request from Ann',
        text: 'Ann needs help with IT.'
      }
    },
    {
      name: 'Confirmation',
      mail: {
        to: ['ann@example.com'],
        subject: 'We received your request',
        text: 'Thanks Ann!'
      }
    }
  ])
})

test('a mail is not sent when its rules do not hold or it has no address', () => {
  const names = formMails(inputs, rows, mails, {name: 'Bo', service: 'hr'}).map(
    out => out.name
  )
  expect(names).toEqual([])
})

test('answers can not add lines to the headers of a mail', () => {
  const [helpdesk, ...rest] = formMails(inputs, rows, mails, {
    name: 'Ann\r\nBcc: all@example.com',
    email: 'ann@example.com\nBcc: all@example.com',
    service: 'it'
  })
  expect(helpdesk.mail.subject).toBe(
    'New request from Ann Bcc: all@example.com'
  )
  expect(helpdesk.mail.replyTo).toBeUndefined()
  expect(rest).toEqual([])
})

test('a mail can be sent for one language only', () => {
  const dutch = {
    _id: 'dutch',
    _index: 'a3',
    _type: 'mail',
    name: 'Dutch desk',
    to: 'address',
    address: 'nl@example.com',
    sendWhen: {
      match: 'all',
      rules: [{id: 'r', input: '@locale', op: 'is', value: ['nl']}]
    },
    subject: 'Nieuw',
    body: ''
  }
  const names = (locale?: string) =>
    formMails(inputs, rows, [dutch], values, locale).map(out => out.name)
  expect(names('nl')).toEqual(['Dutch desk'])
  expect(names('NL')).toEqual(['Dutch desk'])
  expect(names('en')).toEqual([])
  expect(names()).toEqual([])
})
