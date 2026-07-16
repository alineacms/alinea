import {Type, type} from '#/core/Type.js'
import {Field} from '#/core/Field.js'
import {suite} from '@alinea/suite'
import {
  MetadataTimestampField,
  MetadataUserField,
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

test('metadata audit stamps created user when created date is missing', () => {
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
    createdAt: 1685703439,
    createdBy: {name: 'John Doe', email: 'info@codeurs.be'},
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

  test.ok(fields.createdAt instanceof MetadataTimestampField)
  test.ok(fields.updatedAt instanceof MetadataTimestampField)
  test.ok(fields.createdBy instanceof MetadataUserField)
  test.ok(fields.updatedBy instanceof MetadataUserField)
})
