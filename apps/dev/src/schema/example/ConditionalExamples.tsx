import {Config, Field} from 'alinea'

const rootField = Field.select('Root field', {
  initialValue: 'a',
  options: {
    a: 'Option a',
    b: 'Option b'
  }
})

const showIfA = Config.track.options(Field.text('Show if A'), get => {
  return {hidden: get(rootField) !== 'a'}
})
const showIfB = Config.track.options(Field.text('Show if B'), get => {
  return {hidden: get(rootField) !== 'b'}
})

const nestedList = Field.list('Nested list', {
  schema: {
    Row: Config.type('List item', {
      fields: {
        a: showIfA,
        b: showIfB
      }
    })
  }
})

export const ConditionalExamples = Config.document('Conditional fields', {
  fields: {
    rootField,
    nestedList
  }
})
