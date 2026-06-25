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
      condition: {_type: 'Event'},
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
    }),

    ...Field.view(<hr />),

    locationsTest: Field.entry('Locations test', {
      location: info => {
        if (info.entry.workspace === 'primary') {
          return {
            workspace: 'primary',
            root: 'pages'
          }
        }
        return {workspace: 'secondary', root: 'pages'}
      },
      condition: {
        _type: 'Page'
      }
    }),

    // Field.url variants
    externalLinkHelp: Field.url('External link (help)', {
      help: 'Enter any valid URL starting with https://'
    }),
    externalLinkInline: Field.url('External link (inline)', {
      inline: true
    }),
    externalLinkWidth: Field.url('External link (half width)', {
      width: 0.5
    }),
    externalLinkWithFields: Field.url('External link (with extra fields)', {
      fields: {
        label: Field.text('Link label', {width: 0.5}),
        openInNewTab: Field.check('Open in new tab', {width: 0.5})
      }
    }),
    externalLinkMultiple: Field.url.multiple('External link (multiple)'),
    externalLinkMultipleWithFields: Field.url.multiple(
      'External link (multiple with fields)',
      {
        fields: {
          label: Field.text('Link label', {width: 0.5}),
          openInNewTab: Field.check('Open in new tab', {width: 0.5})
        },
        max: 3
      }
    ),

    // Field.entry variants
    entryInline: Field.entry('Internal link (inline)', {
      inline: true
    }),
    entryWidth: Field.entry('Internal link (half width)', {
      width: 0.5
    }),
    entryDefaultViewThumb: Field.entry('Internal link (thumb view)', {
      defaultView: 'thumb'
    }),
    entryWithStaticLocation: Field.entry('With static location', {
      location: {workspace: 'primary', root: 'fields'}
    }),
    entryMultiple: Field.entry.multiple('Internal link (multiple)'),
    entryMultipleWithCondition: Field.entry.multiple(
      'Internal link (multiple, with condition)',
      {
        condition: {_type: 'BasicFields'}
      }
    ),
    entryMultipleWithMax: Field.entry.multiple(
      'Internal link (multiple, max 3)',
      {
        max: 3
      }
    ),
    entryMultipleWithFields: Field.entry.multiple(
      'Internal link (multiple, with extra fields)',
      {
        fields: {
          fieldA: Field.text('Field A', {width: 0.5}),
          fieldB: Field.text('Field B', {width: 0.5, required: true})
        }
      }
    ),

    // Field.file variants
    fileInline: Field.file('File link (inline)', {
      inline: true
    }),
    fileWithFields: Field.file('File link (with extra fields)', {
      fields: {
        caption: Field.text('Caption', {width: 0.5}),
        description: Field.text('Description', {width: 0.5})
      }
    }),
    fileMultiple: Field.file.multiple('File link (multiple)'),
    fileMultipleWithMax: Field.file.multiple('File link (multiple, max 5)', {
      max: 5
    }),
    fileMultipleWithFields: Field.file.multiple(
      'File link (multiple, with extra fields)',
      {
        fields: {
          caption: Field.text('Caption', {width: 0.5}),
          description: Field.text('Description', {width: 0.5})
        }
      }
    ),

    // Field.image variants
    imageInline: Field.image('Image link (inline)', {
      inline: true
    }),
    imageWithFields: Field.image('Image link (with extra fields)', {
      fields: {
        alt: Field.text('Alt text', {width: 0.5}),
        caption: Field.text('Caption', {width: 0.5})
      }
    }),
    imageMultipleWithMax: Field.image.multiple('Image link (multiple, max 4)', {
      max: 4
    }),
    imageMultipleWithFields: Field.image.multiple(
      'Image link (multiple, with extra fields)',
      {
        fields: {
          alt: Field.text('Alt text', {width: 0.5}),
          caption: Field.text('Caption', {width: 0.5})
        }
      }
    ),

    // Field.link (single) variants
    link: Field.link('Mixed link (single)'),
    linkInline: Field.link('Mixed link (inline)', {
      inline: true
    }),
    linkWithCondition: Field.link('Mixed link (with condition)', {
      condition: {_type: 'Page'}
    }),
    linkWithLocation: Field.link('Mixed link (with location)', {
      location: {workspace: 'primary', root: 'fields'}
    }),
    linkWithEnableNavigation: Field.link('Mixed link (enable navigation)', {
      enableNavigation: true
    }),
    linkWithFields: Field.link('Mixed link (with extra fields)', {
      fields: {
        label: Field.text('Link label', {width: 0.5}),
        openInNewTab: Field.check('Open in new tab', {width: 0.5})
      }
    }),

    // Field.link.multiple variants
    linkMultipleWithCondition: Field.link.multiple(
      'Mixed links, multiple (with condition)',
      {
        condition: {_type: 'Page'}
      }
    ),
    linkMultipleWithLocation: Field.link.multiple(
      'Mixed links, multiple (with location)',
      {
        location: {workspace: 'primary', root: 'fields'}
      }
    ),
    linkMultipleWithMax: Field.link.multiple('Mixed links, multiple (max 5)', {
      max: 5
    }),
    linkMultiplePickChildren: Field.link.multiple(
      'Mixed links, multiple (pick children)',
      {
        pickChildren: true
      }
    ),
    linkMultipleEnableNavigation: Field.link.multiple(
      'Mixed links, multiple (enable navigation)',
      {
        enableNavigation: true
      }
    )
  }
})
