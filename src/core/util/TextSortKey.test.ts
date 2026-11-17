import {expect, test} from 'bun:test'
import {textSortKey} from './TextSortKey.js'

function sorted(titles: Array<string>) {
  return titles
    .map(title => ({title, key: textSortKey(title)}))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map(({title}) => title)
}

test('ignores case and accents', () => {
  expect(
    sorted(['Zebra', 'émile', 'Eagle', 'apple', 'Äpfel', 'Ørsted'])
  ).toEqual(['Äpfel', 'apple', 'Eagle', 'émile', 'Ørsted', 'Zebra'])
  expect(textSortKey('Straße')).toBe(textSortKey('STRASSE'))
})

test('skips leading punctuation and quotes', () => {
  expect(
    sorted([
      '"Quoted"',
      'Banana',
      '‘Single’',
      '« Guillemets »',
      '(Aside)',
      'Zoo'
    ])
  ).toEqual([
    '(Aside)',
    'Banana',
    '« Guillemets »',
    '"Quoted"',
    '‘Single’',
    'Zoo'
  ])
  // Text of punctuation only keeps it
  expect(textSortKey('...')).toBe('...')
})

test('orders numbers by their value', () => {
  expect(
    sorted(['Item 10', 'Item 2', 'Item 1', 'Item 02b', 'Item 100'])
  ).toEqual(['Item 1', 'Item 2', 'Item 02b', 'Item 10', 'Item 100'])
})
