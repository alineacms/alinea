// tests/demo.js
import {test} from 'uvu'
import * as assert from 'uvu/assert'
import * as Y from 'yjs'
import {Type} from '../src/Type'

const example = '<p>This is <b>some</b> valid html.</p>'

test('XmlFragment assumptions', () => {
  const ydoc = new Y.Doc()
  const fragment = ydoc.getXmlFragment()
  const p = new Y.XmlElement('p')
  fragment.push([p])
  p.insert(0, [new Y.XmlText('test')])
  assert.is(fragment.firstChild!.toString(), '<p>test</p>')
})

test('XmlFragmentType parser', () => {
  const ydoc = new Y.Doc()
  const fragment = Type.XmlFragment.toY(example)
  const root = ydoc.getMap('root')
  root.set('test', fragment)
  assert.is(fragment.toString(), example)
})

test.run()
