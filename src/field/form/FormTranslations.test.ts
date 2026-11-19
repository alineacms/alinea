import {Form} from '#/index.js'
import {expect, test} from 'bun:test'
import {translationDifferences} from './FormTranslations.js'

const options = (...values: Array<string>) =>
  values.map((value, index) => ({
    _id: value,
    _index: `a${index}`,
    _type: 'option',
    label: value,
    value
  }))

const dutch = [
  {_id: 'a', _index: 'a0', _type: 'text', label: 'Naam', key: 'naam'},
  {_id: 'b', _index: 'a1', _type: 'email', label: 'E-mail', key: 'email'},
  {
    _id: 'c',
    _index: 'a2',
    _type: 'radio',
    label: 'Kot',
    key: 'kot',
    options: options('ja', 'nee')
  }
]

test('languages that ask the same keys do not differ', () => {
  const english = dutch.map(row => ({...row, label: `${row.label} (en)`}))
  expect(
    translationDifferences(Form.defaults, dutch, [
      {locale: 'en', rows: english}
    ])
  ).toEqual([])
})

test('missing keys, other types and other option values are reported', () => {
  const english = [
    {...dutch[0], key: 'name'},
    {...dutch[1], _type: 'text'},
    {...dutch[2], options: options('yes', 'no')}
  ]
  expect(
    translationDifferences(Form.defaults, dutch, [
      {locale: 'en', rows: english}
    ])
  ).toEqual([
    {
      locale: 'en',
      problems: [
        'Naam (naam) is not in EN',
        'E-mail is Email here and Text in EN',
        'Kot has other option values in EN',
        'Naam (name) is only in EN'
      ]
    }
  ])
})
