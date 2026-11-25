import {Field as CoreField} from '#/core/Field.js'
import {Field, Form} from '#/index.js'
import {expect, test} from 'bun:test'
import {answerKeys, formMails, mailTextProblem} from './FormMails.js'

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
  const sent = formMails(inputs, rows, mails, values).map(
    ({name, mail: {content, html, ...mail}}) => ({name, mail})
  )
  expect(sent).toEqual([
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
    formMails(inputs, rows, [dutch], values, {locale}).map(out => out.name)
  expect(names('nl')).toEqual(['Dutch desk'])
  expect(names('NL')).toEqual(['Dutch desk'])
  expect(names('en')).toEqual([])
  expect(names()).toEqual([])
})

test('a mail is copied to its cc addresses', () => {
  const [mail] = formMails(
    inputs,
    rows,
    [{...mails[1], cc: 'boss@example.com; desk@example.com'}],
    values
  )
  expect(mail.mail.cc).toEqual(['boss@example.com', 'desk@example.com'])
  expect(formMails(inputs, rows, [mails[1]], values)[0].mail.cc).toBeUndefined()
})

test('all answers fills in every answer with its label', () => {
  const answers = {...rows[0], _id: 'answers', _index: 'a3', label: 'Answers'}
  const [mail] = formMails(
    inputs,
    [...rows, answers],
    [{...mails[1], body: '{{all answers}}\n{{answers}}'}],
    {...values, answers: 'Mine'}
  )
  expect(mail.mail.text).toBe(
    'Name: Ann\nEmail: ann@example.com\nService: IT\nAnswers: Mine\nMine'
  )
})

test('a key the form does not have is a problem, but the mail is sent', () => {
  const keys = answerKeys(inputs, rows)
  const typo = {...mails[1], subject: 'From {{nmae}}', body: '{{all answers}}'}
  expect(mailTextProblem(mails[1], keys)).toBeUndefined()
  expect(mailTextProblem(typo, keys)).toBe(
    'Confirmation: Subject uses {{nmae}}, which is not a key of this form'
  )
  expect(mailTextProblem(mails[0], keys, 'nl')).toBe(
    'IT helpdesk: Body in NL uses {{unknown}}, which is not a key of this form'
  )
  expect(formMails(inputs, rows, [typo], values)[0].mail.subject).toBe('From ')
})

const text = (text: string, marks?: Array<object>) => ({
  _type: 'text',
  text,
  ...(marks && {marks})
})
const paragraph = (...content: Array<object>) => ({
  _type: 'paragraph',
  content
})
const richMail = (body: Array<object>) => ({...mails[1], body})

test('a rich text body is sent as text and html', () => {
  const link = {_type: 'link', _id: 'l', _link: 'url', href: 'https://x.org'}
  const [{mail}] = formMails(
    inputs,
    rows,
    [
      richMail([
        {_type: 'heading', level: 2, content: [text('Hi {{name}}')]},
        paragraph(text('See '), text('our site', [link, {_type: 'bold'}])),
        {
          _type: 'bulletList',
          content: [{_type: 'listItem', content: [paragraph(text('One'))]}]
        }
      ])
    ],
    values
  )
  expect(mail.text).toBe('Hi Ann\n\nSee our site (https://x.org)\n\n- One')
  expect(mail.content).toBe(
    '<h2 style="margin:0 0 16px;font-size:20px;line-height:1.3">Hi Ann</h2>' +
      '<p style="margin:0 0 16px">See <a href="https://x.org" ' +
      'style="color:#2563eb;text-decoration:underline">' +
      '<strong>our site</strong></a></p>' +
      '<ul style="margin:0 0 16px;padding:0 0 0 24px">' +
      '<li style="margin:0 0 4px">One</li></ul>'
  )
  expect(mail.content).not.toContain('class=')
  expect(mail.html).toStartWith('<!doctype html>')
  expect(mail.html).toContain('<title>We received your request</title>')
  expect(mail.html).toContain(mail.content)
})

test('answers are escaped in html', () => {
  const [{mail}] = formMails(
    inputs,
    rows,
    [richMail([paragraph(text('From {{name}}'))])],
    {...values, name: '<b>Ann</b> & "Bo"'}
  )
  expect(mail.content).toBe(
    '<p style="margin:0 0 16px">From ' +
      '&lt;b&gt;Ann&lt;/b&gt; &amp; &quot;Bo&quot;</p>'
  )
  expect(mail.text).toBe('From <b>Ann</b> & "Bo"')
})

test('all answers is a table in html', () => {
  const [{mail}] = formMails(
    inputs,
    rows,
    [richMail([paragraph(text('{{all answers}}'))])],
    {...values, name: 'A<n>'}
  )
  expect(mail.text).toBe('Name: A<n>\nEmail: ann@example.com\nService: IT')
  expect(mail.content).toStartWith('<table role="presentation"')
  expect(mail.content).not.toContain('<p')
  const cells = [...mail.content.matchAll(/<t[hd][^>]*>([^<]*)</g)]
  expect(cells.map(([, cell]) => cell)).toEqual([
    'Name',
    'A&lt;n&gt;',
    'Email',
    'ann@example.com',
    'Service',
    'IT'
  ])
})

test('links only keep safe urls', () => {
  const mark = (href: string) => ({_type: 'link', _id: href, href})
  const [{mail}] = formMails(
    inputs,
    rows,
    [
      richMail([
        paragraph(
          text('a', [mark('javascript:alert(1)')]),
          text('b', [mark('mailto:x@y.z')])
        )
      ])
    ],
    values
  )
  expect(mail.content).not.toContain('javascript')
  expect(mail.content).toContain('href="mailto:x@y.z"')
})

test('links to entries use their url', () => {
  const entryLink = {_type: 'link', _id: 'e', _link: 'entry', _entry: 'terms'}
  const [{mail}] = formMails(
    inputs,
    rows,
    [richMail([paragraph(text('Terms', [entryLink]))])],
    values,
    {entries: {terms: 'https://example.com/terms'}}
  )
  expect(mail.text).toBe('Terms (https://example.com/terms)')
  expect(mail.content).toContain('href="https://example.com/terms"')
})

test('a plain text body reads as paragraphs', () => {
  const [{mail}] = formMails(
    inputs,
    rows,
    [{...mails[1], body: 'Hi {{name}},\nthanks.\n\nThe team'}],
    values
  )
  expect(mail.text).toBe('Hi Ann,\nthanks.\n\nThe team')
  expect(mail.content).toBe(
    '<p style="margin:0 0 16px">Hi Ann,<br>thanks.</p>' +
      '<p style="margin:0 0 16px">The team</p>'
  )
})

test('submission link links to the submission in the dashboard', () => {
  const link = 'https://example.com/admin#/edit?id=form'
  const body = [paragraph(text('{{submission link}}'))]
  const [{mail}] = formMails(inputs, rows, [richMail(body)], values, {link})
  expect(mail.text).toBe(link)
  expect(mail.content).toContain(`<a href="${link}"`)
  expect(mail.content).toContain('>View the submission</a>')
  const [without] = formMails(inputs, rows, [richMail(body)], values)
  expect(without.mail.text).toBe('')
})

test('mails add their texts in the language of the form', () => {
  const link = 'https://example.com/admin#/edit?id=form'
  const terms = {_id: 'terms', _index: 'a3', _type: 'check', label: 'Terms'}
  const body = [
    paragraph(text('{{all answers}}')),
    paragraph(text('{{submission link}}'))
  ]
  const answers = {...values, terms: true}
  const send = (locale: string, options = {}) =>
    formMails(inputs, [...rows, terms], [richMail(body)], answers, {
      locale,
      link,
      ...options
    })[0].mail
  const dutch = send('nl-BE')
  expect(dutch.text).toContain('Terms: Ja')
  expect(dutch.content).toContain('>Bekijk de inzending</a>')
  expect(send('en').text).toContain('Terms: Yes')
  const own = send('nl', {messages: {nl: {checked: 'Akkoord'}}})
  expect(own.text).toContain('Terms: Akkoord')
})

test('a mail can attach the uploaded files', () => {
  const [out] = formMails(inputs, rows, [{...mails[1], attach: true}], values)
  expect(out.attach).toBe(true)
  expect(formMails(inputs, rows, [mails[1]], values)[0].attach).toBeUndefined()
})

test('unknown keys in a rich text body are a problem', () => {
  const keys = answerKeys(inputs, rows)
  const known = richMail([
    paragraph(text('{{name}} {{all answers}} {{submission link}}'))
  ])
  expect(mailTextProblem(known, keys)).toBeUndefined()
  const typo = richMail([paragraph(text('Hi'), text('{{nmae}}'))])
  expect(mailTextProblem(typo, keys, 'nl')).toBe(
    'Confirmation: Body in NL uses {{nmae}}, which is not a key of this form'
  )
})
