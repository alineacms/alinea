import {Config, Field, Query} from 'alinea'

export const LinkFields = Config.document('Link fields', {
  fields: {
    externalLink: Field.url('External link'),
    entry: Field.entry('Internal link'),
    entryWithCondition: Field.entry('With condition', {
      help: `Show only entries of type Fields in the main workspace`,
      location: {workspace: 'primary', root: 'fields'},
      condition: Query.type.is('Fields')
    }),
    linkMultiple: Field.link.multiple('Mixed links, multiple'),
    image: Field.image('Image link'),
    images: Field.image.multiple('Image link (multiple)'),
    file: Field.entry('File link'),
    withFields: Field.entry('With extra fields', {
      fields: {
        fieldA: Field.text('Field A', {width: 0.5}),
        fieldB: Field.text('Field B', {width: 0.5})
      }
    }),
    multipleWithFields: Field.link.multiple('Multiple With extra fields', {
      fields: {
        fieldA: Field.text('Field A', {width: 0.5}),
        fieldB: Field.text('Field B', {width: 0.5, required: true})
      }
    })
  }
})
