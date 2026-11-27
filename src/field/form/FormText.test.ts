import {textDoc} from '#/core/TextDoc.js'
import {Form} from '#/index.js'
import {expect, test} from 'bun:test'
import {formDefinition} from './FormDefinition.js'
import {shareForm} from './FormShare.js'

const paragraph = (text: string) => [
  {_type: 'paragraph', content: [{_type: 'text', text}]}
]

test('plain text reads as one paragraph', () => {
  expect(textDoc('Hello')).toEqual(paragraph('Hello'))
  expect(textDoc('')).toEqual([])
  expect(textDoc(undefined)).toEqual([])
  expect(textDoc(paragraph('Hi'))).toEqual(paragraph('Hi'))
})

test('help stored as plain text is rich text in the definition', () => {
  const [name, about] = formDefinition(Form.defaults, [
    {
      _id: 'n',
      _index: 'a0',
      _type: 'text',
      label: 'Name',
      help: 'As on your id'
    },
    {
      _id: 's',
      _index: 'a1',
      _type: 'section',
      label: 'About',
      help: paragraph('Tell us more'),
      inputs: []
    }
  ])
  expect(name.help).toEqual(paragraph('As on your id'))
  expect(about.help).toEqual(paragraph('Tell us more'))
})

test('empty help is left out', () => {
  const [name] = formDefinition(Form.defaults, [
    {_id: 'n', _index: 'a0', _type: 'text', label: 'Name', help: paragraph(' ')}
  ])
  expect('help' in name).toBe(false)
})

test('a check has its text in its settings, unless it is empty', () => {
  const text = paragraph('I agree to the terms')
  const [terms, news] = formDefinition(Form.defaults, [
    {_id: 't', _index: 'a0', _type: 'check', label: 'Terms', text},
    {_id: 'n', _index: 'a1', _type: 'check', label: 'News', text: []}
  ])
  if (terms.control !== 'check' || news.control !== 'check')
    throw new Error('Expected checks')
  expect(terms.settings.text).toEqual(text)
  expect(news.settings).toEqual({})
})

test('the help and the text of a check are texts of each language', () => {
  const english = [
    {
      _id: 't',
      _index: 'a0',
      _type: 'check',
      label: 'Terms',
      text: paragraph('I agree'),
      help: paragraph('Read them first'),
      required: true
    }
  ]
  const dutch = [
    {
      _id: 't',
      _index: 'a0',
      _type: 'check',
      label: 'Voorwaarden',
      text: paragraph('Ik ga akkoord'),
      help: 'Lees ze eerst'
    }
  ]
  expect(shareForm(Form.defaults, english, dutch)).toEqual([
    {...dutch[0], required: true}
  ])
})
