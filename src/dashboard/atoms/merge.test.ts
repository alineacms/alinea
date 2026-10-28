import {expect, test} from 'bun:test'
import {merge} from './merge.js'

function row(id: string, index: string, text: string) {
  return {_id: id, _index: index, _type: 'Text', text}
}

test('merges changes to different fields', () => {
  const base = {title: 'Title', intro: 'Intro'}
  const mine = {title: 'My title', intro: 'Intro'}
  const theirs = {title: 'Title', intro: 'Their intro'}
  expect(merge(base, mine, theirs)).toEqual({
    value: {title: 'My title', intro: 'Their intro'},
    conflicts: []
  })
})

test('keeps theirs when nothing was edited', () => {
  const theirs = {title: 'Theirs', list: [row('a', 'a0', 'A')]}
  const base = {title: 'Title', list: []}
  expect(merge(base, {...base}, theirs).value).toBe(theirs)
})

test('pairs list rows by id', () => {
  const a = row('a', 'a0', 'A')
  const b = row('b', 'a1', 'B')
  const base = {list: [a, b]}
  // They inserted a row at the start, I edited the second row
  const mine = {list: [a, {...b, text: 'My B'}]}
  const theirs = {list: [row('c', 'Zz', 'C'), a, b]}
  expect(merge(base, mine, theirs)).toEqual({
    value: {list: [row('c', 'Zz', 'C'), a, {...b, text: 'My B'}]},
    conflicts: []
  })
})

test('merges added, moved and removed rows', () => {
  const a = row('a', 'a0', 'A')
  const b = row('b', 'a1', 'B')
  const c = row('c', 'a2', 'C')
  const base = {list: [a, b, c]}
  // I moved c to the start and removed b, they edited a and added d
  const mine = {list: [{...c, _index: 'Zz'}, a]}
  const theirs = {list: [{...a, text: 'Their A'}, b, c, row('d', 'a3', 'D')]}
  expect(merge(base, mine, theirs)).toEqual({
    value: {
      list: [{...c, _index: 'Zz'}, {...a, text: 'Their A'}, row('d', 'a3', 'D')]
    },
    conflicts: []
  })
})

test('reports values both changed, mine wins', () => {
  const a = row('a', 'a0', 'A')
  const base = {title: 'Title', list: [a], tags: ['x']}
  const mine = {title: 'Mine', list: [{...a, text: 'My A'}], tags: ['y']}
  const theirs = {title: 'Theirs', list: [{...a, text: 'Their A'}], tags: []}
  expect(merge(base, mine, theirs)).toEqual({
    value: mine,
    conflicts: [['title'], ['list', 'a', 'text'], ['tags']]
  })
})

test('a row removed on one side and edited on the other conflicts', () => {
  const a = row('a', 'a0', 'A')
  const base = {list: [a]}
  expect(merge(base, {list: []}, {list: [{...a, text: 'Their A'}]})).toEqual({
    value: {list: []},
    conflicts: [['list', 'a']]
  })
})
