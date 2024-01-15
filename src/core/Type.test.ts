import {Type, type} from 'alinea/core'
import {list, richText, text} from 'alinea/input'
import {test} from 'uvu'
import * as assert from 'uvu/assert'

const Test = type('Test', {
  a: text('A'),
  b: text('B', {searchable: true}),
  list: list('List', {
    schema: {
      Sub: type({
        c: text('C'),
        d: text('D', {searchable: true})
      })
    }
  }),
  rich: richText('Rich', {searchable: true})
})

const value = {
  a: 'A',
  b: 'B',
  list: [{id: '123', type: 'Sub', c: 'C', d: 'D'}],
  rich: [
    {
      type: 'heading',
      content: [{type: 'text', text: 'Rich text'}]
    },
    {
      type: 'paragraph',
      content: [{type: 'text', text: 'Lorem ipsum'}]
    }
  ]
}

test('Searchable text', () => {
  const text = Type.searchableText(Test, value)
  assert.is(text, 'B D Rich text Lorem ipsum')
})

test.run()
