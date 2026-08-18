import {Config, Field} from 'alinea'

export const LinkFields = Config.document('Link fields', {
  fields: {
    externalLink: Field.url('External link'),
    entry: Field.entry('Internal link'),
    entryWithCondition: Field.entry('With condition', {
      help: 'Show only entries of type BasicFields',
      condition: {_type: 'BasicFields'}
    }),
    entryWithConditionAndNav: Field.entry('With condition and navigation', {
      help: 'Show only entries of type BasicFields',
      condition: {_type: 'BasicFields'},
      enableNavigation: true
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
    }),

    entryWithMultipleConditions: Field.entry('With multiple conditions', {
      condition: {_type: 'Page', _status: 'published'}
    }),

    entryWithArrayConditions: Field.entry('With array conditions', {
      condition: {_type: {in: ['Folder', 'Page']}}
    }),

    entryWithParentCondition: Field.entry('With parent condition', {
      condition: {_parentId: '2dgfSWKFaEqxaimsO32A1sR9iMw'}
    }),

    entryWithConditionLocation: Field.entry('With condition & location', {
      condition: {_type: 'Folder'},
      location: {workspace: 'primary', root: 'fields'}
    }),

    entryEnableNavigation: Field.entry('Enable navigation', {
      enableNavigation: true,
      condition: {_type: 'LinkFields'}
    }),

    entryPickChildren: Field.entry('Pick children', {
      pickChildren: true
    }),

    entryPickChildrenWithCondition: Field.entry(
      'Pick children with condition',
      {
        pickChildren: true,
        condition: {_type: 'LayoutFields'}
      }
    ),

    entryAdvancedConditions: Field.entry.multiple('Entry advanced conditions', {
      enableNavigation: true,
      location: {workspace: 'primary', root: 'fields'},
      condition: {
        _workspace: 'primary',
        _root: {in: ['fields']},
        _status: 'published',
        _type: {
          in: ['BasicFields', 'Page']
        }
      },
      max: 3
    })
  }
})
