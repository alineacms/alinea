export type FieldPreviewKey =
  | 'text'
  | 'richText'
  | 'select'
  | 'number'
  | 'check'
  | 'date'
  | 'time'
  | 'code'
  | 'path'
  | 'link'
  | 'entry'
  | 'url'
  | 'image'
  | 'file'
  | 'list'
  | 'object'
  | 'tabs'
  | 'localiser'

export interface FieldCatalogItem {
  key: FieldPreviewKey
  name: string
  /** The function that creates the field, eg. `Field.text` */
  call: string
  /** What the field stores in the entry */
  stores: string
  description: string
  href: string
  isNew?: boolean
}

export interface FieldCatalogGroup {
  id: string
  title: string
  items: Array<FieldCatalogItem>
}

export const fieldCatalog: Array<FieldCatalogGroup> = [
  {
    id: 'basic',
    title: 'Basic',
    items: [
      {
        key: 'text',
        name: 'Text',
        call: 'Field.text',
        stores: 'string',
        description: 'A single or multiline plain string.',
        href: '/docs/fields/text'
      },
      {
        key: 'richText',
        name: 'Rich text',
        call: 'Field.richText',
        stores: 'TextDoc',
        description:
          'Formatted text with headings, links, tables and your own blocks.',
        href: '/docs/fields/rich-text'
      },
      {
        key: 'select',
        name: 'Select',
        call: 'Field.select',
        stores: 'option key',
        description: 'One or more keys from a fixed set of options.',
        href: '/docs/fields/select'
      },
      {
        key: 'number',
        name: 'Number',
        call: 'Field.number',
        stores: 'number',
        description: 'A number, kept between the bounds you set.',
        href: '/docs/fields/number'
      },
      {
        key: 'check',
        name: 'Check',
        call: 'Field.check',
        stores: 'boolean',
        description: 'A checkbox that stores true or false.',
        href: '/docs/fields/check'
      },
      {
        key: 'date',
        name: 'Date',
        call: 'Field.date',
        stores: 'date string',
        description: 'A calendar date, stored without a timezone.',
        href: '/docs/fields/date'
      },
      {
        key: 'time',
        name: 'Time',
        call: 'Field.time',
        stores: 'time string',
        description: 'A time of day, stored without a timezone.',
        href: '/docs/fields/date'
      },
      {
        key: 'code',
        name: 'Code',
        call: 'Field.code',
        stores: 'string',
        description: 'A monospace editor with syntax highlighting.',
        href: '/docs/fields/code'
      },
      {
        key: 'path',
        name: 'Path',
        call: 'Field.path',
        stores: 'URL segment',
        description: 'The URL segment of an entry, generated from its title.',
        href: '/docs/fields/path'
      }
    ]
  },
  {
    id: 'links',
    title: 'Links and media',
    items: [
      {
        key: 'link',
        name: 'Link',
        call: 'Field.link',
        stores: 'entry, URL or file',
        description: 'A link to an entry, an external URL or a file.',
        href: '/docs/fields/link'
      },
      {
        key: 'entry',
        name: 'Entry',
        call: 'Field.entry',
        stores: 'entry reference',
        description: 'A reference to other entries in the CMS.',
        href: '/docs/fields/entry'
      },
      {
        key: 'url',
        name: 'URL',
        call: 'Field.url',
        stores: 'external link',
        description: 'A link to an external website, email or phone number.',
        href: '/docs/fields/url'
      },
      {
        key: 'image',
        name: 'Image',
        call: 'Field.image',
        stores: 'image reference',
        description: 'An image from the media library, with focal point.',
        href: '/docs/fields/image'
      },
      {
        key: 'file',
        name: 'File',
        call: 'Field.file',
        stores: 'file reference',
        description: 'A file from the media library, such as a PDF.',
        href: '/docs/fields/file'
      }
    ]
  },
  {
    id: 'structure',
    title: 'Structure',
    items: [
      {
        key: 'list',
        name: 'List',
        call: 'Field.list',
        stores: 'array of rows',
        description: 'An ordered list of blocks that editors add and reorder.',
        href: '/docs/fields/list'
      },
      {
        key: 'object',
        name: 'Object',
        call: 'Field.object',
        stores: 'nested object',
        description: 'A group of fields stored together as one object.',
        href: '/docs/fields/object'
      },
      {
        key: 'tabs',
        name: 'Tabs',
        call: 'Field.tabs',
        stores: 'layout only',
        description: 'Splits a long form into tabs, values stay on the entry.',
        href: '/docs/fields/tabs'
      },
      {
        key: 'localiser',
        name: 'Localiser',
        call: 'Field.localiser',
        stores: 'value per locale',
        description: 'Keeps every translation of a value in a single field.',
        href: '/docs/internationalization#localised-fields',
        isNew: true
      }
    ]
  }
]

/** Fields without a card, listed below the catalog */
export const otherFields: Array<{call: string; description: string}> = [
  {
    call: 'Field.metadata',
    description: 'SEO and Open Graph fields, plus URL aliases and timestamps'
  },
  {call: 'Field.json', description: 'Any JSON value in a plain JSON editor'},
  {
    call: 'Field.view',
    description: 'A React element placed between fields, such as a note'
  }
]
