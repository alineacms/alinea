import {Config, Field} from 'alinea'

export const LinkFields = Config.document('Link fields', {
  fields: {
    externalLink: Field.url('External link'),
    entry: Field.entry('Internal link'),
    entryWithCondition: Field.entry('With condition', {
      help: 'Show only entries of type BasicFields',
      condition: {_type: 'BasicFields'}
    }),
    entryWithLocation: Field.entry('With location', {
      async location({graph}) {
        const subFolder = await graph.get({path: 'sub-folder'})
        return {
          parentId: subFolder._id,
          workspace: subFolder._workspace,
          root: subFolder._root
        }
      }
    }),
    linkMultiple: Field.link.multiple('Mixed links, multiple'),
    image: Field.image('Image link'),
    images: Field.image.multiple('Image link (multiple)'),
    file: Field.file('File link'),
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
