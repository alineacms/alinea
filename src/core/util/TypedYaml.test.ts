import {suite} from '@alinea/suite'
import {typedFromYaml, typedToYaml} from './TypedYaml.js'

const test = suite(import.meta)

test('writes the type as the key', () => {
  test.equal(typedToYaml('Block', {title: 'a'}), {Block: {title: 'a'}})
  test.equal(typedToYaml('Block', {}), {Block: null})
})

test('reads the keyed and the inline form', () => {
  test.equal(typedFromYaml({Block: {title: 'a'}}), ['Block', {title: 'a'}])
  test.equal(typedFromYaml({Block: null}), ['Block', {}])
  test.equal(typedFromYaml({_type: 'Block', title: 'a'}), [
    'Block',
    {title: 'a'}
  ])
  test.is(typedFromYaml({a: 1, b: 2}), undefined)
  test.is(typedFromYaml({Block: 'text'}), undefined)
  test.is(typedFromYaml('Block'), undefined)
})
