import {document, isDocument} from '#/core/Document.js'
import {Type, type} from '#/core/Type.js'
import {Field} from '#/core/Field.js'
import {Section} from '#/core/Section.js'
import {check} from '#/field/check.js'
import {TabsSection} from '#/field/tabs.js'
import {text} from '#/field/text.js'
import {suite} from '@alinea/suite'
import {
  MetadataTimestampField,
  MetadataUserField,
  auditMetadata,
  hasAuditMetadata,
  metadata
} from './MetadataField.js'

const test = suite(import.meta)

const user = {
  sub: 'user',
  roles: ['admin'],
  name: 'John Doe',
  email: 'info@codeurs.be'
}

const Article = type('Article', {
  fields: {
    metadata: metadata()
  }
})

test('metadata audit stamps created and updated fields on create', () => {
  const date = new Date('2021-11-09T13:33:19.948Z')
  const result = Type.beforeSave(
    Article,
    {metadata: {title: 'Title'}},
    {action: 'create', user, now: date}
  )

  test.equal(result.metadata, {
    title: 'Title',
    createdAt: 1636464799,
    createdBy: {name: 'John Doe', email: 'info@codeurs.be'},
    updatedAt: 1636464799,
    updatedBy: {name: 'John Doe', email: 'info@codeurs.be'}
  })
})

test('metadata audit preserves created fields when updating', () => {
  const date = new Date('2023-06-02T10:57:19.584Z')
  const result = Type.beforeSave(
    Article,
    {
      metadata: {
        createdAt: 1636464799,
        createdBy: {name: 'Jane Doe', email: 'jane@example.com'},
        updatedAt: 1663839000,
        updatedBy: {name: 'Jane Doe', email: 'jane@example.com'}
      }
    },
    {action: 'update', user, now: date}
  )

  test.equal(result.metadata, {
    createdAt: 1636464799,
    createdBy: {name: 'Jane Doe', email: 'jane@example.com'},
    updatedAt: 1685703439,
    updatedBy: {name: 'John Doe', email: 'info@codeurs.be'}
  })
})

test('metadata audit leaves unknown created fields empty when updating', () => {
  const date = new Date('2023-06-02T10:57:19.584Z')
  const result = Type.beforeSave(
    Article,
    {
      metadata: {
        createdAt: null,
        createdBy: {name: '', email: ''},
        updatedAt: null,
        updatedBy: {name: '', email: ''}
      }
    },
    {action: 'update', user, now: date}
  )

  test.equal(result.metadata, {
    createdAt: null,
    createdBy: {name: '', email: ''},
    updatedAt: 1685703439,
    updatedBy: {name: 'John Doe', email: 'info@codeurs.be'}
  })
})

test('audit metadata leaves unknown created fields and empty aliases out', () => {
  const File = type('File', {fields: {metadata: auditMetadata()}})
  const date = new Date('2023-06-02T10:57:19.584Z')
  const result = Type.beforeSave(
    File,
    {
      metadata: {
        createdAt: null,
        createdBy: {name: '', email: ''},
        updatedAt: null,
        updatedBy: {name: '', email: ''},
        aliases: []
      }
    },
    {action: 'update', user, now: date}
  )

  test.equal(result.metadata, {
    updatedAt: 1685703439,
    updatedBy: {name: 'John Doe', email: 'info@codeurs.be'}
  })
})

test('metadata audit converts existing ISO created dates to timestamps', () => {
  const date = new Date('2023-06-02T10:57:19.584Z')
  const result = Type.beforeSave(
    Article,
    {
      metadata: {
        createdAt: '2021-11-09T13:33:19.948Z',
        createdBy: {name: 'Jane Doe', email: 'jane@example.com'}
      }
    },
    {action: 'update', user, now: date}
  )

  test.equal(result.metadata, {
    createdAt: 1636464799,
    createdBy: {name: 'Jane Doe', email: 'jane@example.com'},
    updatedAt: 1685703439,
    updatedBy: {name: 'John Doe', email: 'info@codeurs.be'}
  })
})

test('metadata fields can be initialized deeply before editing', () => {
  const result = Type.withInitialValue(Article, {
    metadata: {title: 'Title'}
  })

  test.equal(result.metadata, {
    title: 'Title',
    description: '',
    aliases: [],
    openGraph: {
      image: null,
      title: '',
      description: ''
    },
    createdAt: null,
    createdBy: {name: '', email: ''},
    updatedAt: null,
    updatedBy: {name: '', email: ''}
  })
})

test('metadata audit fields use custom display fields', () => {
  const fields = Field.options(Article.metadata).fields

  test.is(Article.metadata.aliases, fields.aliases)
  test.ok(fields.createdAt instanceof MetadataTimestampField)
  test.ok(fields.updatedAt instanceof MetadataTimestampField)
  test.ok(fields.createdBy instanceof MetadataUserField)
  test.ok(fields.updatedBy instanceof MetadataUserField)
})

test('document metadata stays one record split over SEO and details', () => {
  const Page = document('Page', {fields: {}})
  const options = Field.options(Page.metadata)

  test.ok(options.sections)
  test.equal(Object.keys(Type.fields(Page)), ['title', 'path', 'metadata'])
  test.equal(Object.keys(Type.fields(options.seo)), [
    'title',
    'description',
    'openGraph'
  ])
  test.equal(Object.keys(Type.fields(options.details)), [
    'createdAt',
    'createdBy',
    'updatedAt',
    'updatedBy',
    'aliases'
  ])
  test.is(options.seo.title, options.fields.title)
  test.is(options.details.aliases, Page.metadata.aliases)
  test.equal(
    Object.keys(Type.initialValue(Page).metadata as object).sort(),
    Object.keys(Type.fields(options.fields)).sort()
  )
})

test('documents add fields to the SEO and details tabs', () => {
  const Page = document('Page', {
    fields: {body: text('Body')},
    seo: {brand: check('Brand the share image')},
    details: {reviewer: text('Reviewer')}
  })
  const [tabsSection] = Type.sections(Page)
  const [main, seo, details] = (tabsSection[Section.Data] as TabsSection).types
  test.equal(Object.keys(Type.fields(main)), ['title', 'path', 'body'])
  test.equal(Object.keys(Type.fields(seo)), ['metadata', 'brand'])
  test.equal(Object.keys(Type.fields(details)), ['reviewer'])
  test.equal(Object.keys(Type.fields(Page)), [
    'title',
    'path',
    'body',
    'metadata',
    'brand',
    'reviewer'
  ])
})

test('documents let their fields replace the title', () => {
  const title = text('Headline')
  const Page = document('Page', {fields: {title}})
  test.is(Page.title, title)
})

test('documents refuse a field defined twice', () => {
  test.throws(
    () => document('Page', {fields: {}, details: {path: text('Path')}}),
    'Field "path" is defined twice'
  )
})

test('types with either metadata field store audit details', () => {
  const File = type('File', {fields: {metadata: auditMetadata()}})
  const Other = type('Other', {fields: {metadata: text('Metadata')}})
  test.ok(hasAuditMetadata(Article))
  test.ok(hasAuditMetadata(document('Page', {fields: {}})))
  test.ok(hasAuditMetadata(File))
  test.not.ok(hasAuditMetadata(Other))
  test.not.ok(hasAuditMetadata(type('Plain', {fields: {}})))
})

test('documents are told apart from other types', () => {
  test.ok(isDocument(document('Page', {fields: {}})))
  test.not.ok(isDocument(type('Block', {fields: {}})))
})
