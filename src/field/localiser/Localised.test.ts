import {createCMS} from '#/core.js'
import {Entry} from '#/core/Entry.js'
import {Root} from '#/core/Root.js'
import {Type} from '#/core/Type.js'
import {validateEntry} from '#/core/Validation.js'
import {Config, Field} from '#/index.js'
import {createEntryStore} from '#test/EntryFixture.js'
import {suite} from '@alinea/suite'

const test = suite(import.meta)

const fieldI18n = {
  locales: ['en', 'de', 'fr'],
  translate: 'fields' as const,
  fallback(requested: string) {
    return requested === 'fr' ? ['de', 'en'] : ['en']
  }
}

const Product = Config.type('Product', {
  fields: {
    title: Field.text('Title'),
    caption: Field.localised(Field.text('Caption', {required: true})),
    rows: Field.list('Rows', {
      schema: {
        row: Config.type('Row', {
          fields: {label: Field.localised(Field.text('Label'))}
        })
      }
    })
  }
})

function workspace(roots: Parameters<typeof Config.workspace>[1]['roots']) {
  return Config.workspace('Main', {source: 'content/main', roots})
}

test('a root that translates fields keeps a single entry per item', () => {
  const root = Config.root('Products', {i18n: fieldI18n})
  test.is(Root.data(root).i18n, undefined)
  test.equal(Root.fieldI18n(Root.data(root))?.locales, fieldI18n.locales)
  const media = Config.media({i18n: {locales: ['en', 'de']}})
  test.equal(Root.fieldI18n(Root.data(media))?.locales, ['en', 'de'])
})

test('a field with the locales of its root throws in roots that translate entries', () => {
  test.throws(
    () =>
      createCMS({
        schema: {Product},
        workspaces: {
          main: workspace({
            pages: Config.root('Pages', {
              contains: ['Product'],
              i18n: {locales: ['en', 'de']}
            })
          })
        }
      }),
    'Field.localised("Caption") in type "Product" takes the locales of its root'
  )
})

test('a field with the locales of its root holds no object without i18n', () => {
  const Settings = Config.type('Settings', {
    fields: {
      address: Field.localised(
        Field.object('Address', {fields: {street: Field.text('Street')}})
      )
    }
  })
  test.throws(
    () =>
      createCMS({
        schema: {Settings},
        workspaces: {
          main: workspace({
            pages: Config.root('Pages', {contains: ['Settings']})
          })
        }
      }),
    'Field.localised("Address") in type "Settings" holds an object'
  )
  // Roots without contains take every type, the type is meant for others
  createCMS({
    schema: {Settings},
    workspaces: {
      main: workspace({
        pages: Config.root('Pages', {i18n: {locales: ['en', 'de']}})
      })
    }
  })
  // A plain value can't be mistaken for a value per locale
  createCMS({
    schema: {Product},
    workspaces: {main: workspace({pages: Config.root('Pages')})}
  })
})

test('initial values have every locale of the root', () => {
  const data = Type.withInitialValue(
    Product,
    {caption: 'Before', rows: [{_id: 'r', _index: 'a0', _type: 'row'}]},
    {fieldI18n}
  )
  // A plain value stored before the root translated fields holds for each
  test.equal(data.caption, {en: 'Before', de: 'Before', fr: 'Before'})
  test.equal((data.rows as Array<{label: unknown}>)[0].label, {
    en: '',
    de: '',
    fr: ''
  })
  // Without the root, values are left as they are
  test.equal(
    Type.withInitialValue(Product, {caption: 'Plain'}).caption,
    'Plain'
  )
})

test('required applies to each locale of the root', () => {
  const errors = validateEntry(
    Product,
    {caption: {en: 'Chair', de: '', fr: 'Chaise'}},
    {fieldI18n}
  )
  test.equal(
    errors.map(error => error.path),
    [['caption', 'de']]
  )
  test.equal(
    validateEntry(Product, {caption: ''}).map(error => error.path),
    [['caption']]
  )
})

test('queries read the value of the requested locale with the root fallback', async () => {
  const cms = createCMS({
    schema: {Product},
    workspaces: {
      main: workspace({
        products: Config.root('Products', {
          contains: ['Product'],
          i18n: fieldI18n
        }),
        plain: Config.root('Plain', {contains: ['Product']})
      })
    }
  })
  const {store} = await createEntryStore(cms.config, [
    {
      id: 'chair',
      type: 'Product',
      index: 'a0',
      root: 'products',
      data: {
        path: 'chair',
        title: 'Chair',
        caption: {en: 'Chair', de: 'Stuhl', fr: ''},
        rows: [
          {
            _id: 'r',
            _index: 'a0',
            _type: 'row',
            label: {en: 'Seat', de: 'Sitz', fr: 'Siège'}
          }
        ]
      }
    },
    {
      id: 'table',
      type: 'Product',
      index: 'a1',
      root: 'plain',
      data: {path: 'table', title: 'Table', caption: 'Table'}
    }
  ])
  const select = {caption: Product.caption, rows: Product.rows}
  const read = (id: string, locale: string | null) =>
    store.resolve({first: true, id, locale, select})
  test.equal(await read('chair', 'de'), {
    caption: 'Stuhl',
    rows: [{_id: 'r', _index: 'a0', _type: 'row', label: 'Sitz'}]
  })
  // An empty value falls back to the locales the root lists for it
  test.is((await read('chair', 'fr'))?.caption, 'Stuhl')
  // Without a locale the first locale of the root is read
  test.is((await read('chair', null))?.caption, 'Chair')
  // A root without i18n holds the plain value, and has no locales
  test.is(await read('table', 'de'), null)
  test.is((await read('table', null))?.caption, 'Table')
})

test('queries for a locale leave out media files, as before', async () => {
  const cms = createCMS({
    schema: {Product},
    workspaces: {
      main: workspace({
        media: Config.media({i18n: {locales: ['en', 'de']}})
      })
    }
  })
  const {store} = await createEntryStore(cms.config, [
    {
      id: 'folder',
      type: 'MediaLibrary',
      index: 'a0',
      root: 'media',
      data: {path: 'folder', title: 'Folder'}
    }
  ])
  test.equal(await store.resolve({locale: 'de', select: Entry.id}), [])
  test.equal(await store.resolve({locale: null, select: Entry.id}), ['folder'])
})
