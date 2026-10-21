import {suite} from '@alinea/suite'
import {Section} from '#/core/Section.js'
import {Type, type} from '#/core/Type.js'
import {document} from '#/core/Document.js'
import {text} from '#/field/text.js'
import {tab} from '#/field/tabs.js'
import type {TabsSection} from '#/field/tabs/Tabs.js'
import {entryForm} from './EntryForm.js'

const test = suite(import.meta)

test('entries of a type with settings show them in a Settings tab', () => {
  const Product = type('Product', {
    fields: {name: text('Name')},
    settings: {sku: text('SKU')}
  })
  const form = entryForm(Product)
  test.is(entryForm(Product), form)
  const [tabs] = Type.sections(form)
  const data = tabs[Section.Data] as TabsSection
  test.equal(data.types.map(Type.label), ['Content', 'Settings'])
  test.equal(Object.keys(Section.fields(tabs)), ['name', 'sku'])
  test.is(Type.field(form, 'sku'), Type.field(Product, 'sku'))
  const plain = type('Plain', {fields: {name: text('Name')}})
  test.is(entryForm(plain), plain)
})

test('custom tabs follow the content, before the settings', () => {
  const Product = type('Product', {
    fields: {name: text('Name')},
    settings: {sku: text('SKU')},
    tabs: {
      planning: tab('Planning', {fields: {start: text('Start')}}),
      analytics: tab('Analytics', {view: '@/views/Analytics#Analytics'})
    }
  })
  // Their fields are stored like the others
  test.is(Type.field(Product, 'start'), Product.start)
  const [tabs] = Type.sections(entryForm(Product))
  const data = tabs[Section.Data] as TabsSection
  test.equal(data.types.map(Type.label), [
    'Content',
    'Planning',
    'Analytics',
    'Settings'
  ])
  test.equal(Type.sections(data.types[2]).length, 1)
})

test('documents show custom tabs after their Details tab', () => {
  const Article = document('Article', {
    fields: {},
    tabs: {planning: tab('Planning', {fields: {start: text('Start')}})}
  })
  test.is(Type.field(Article, 'start'), Article.start)
  const [tabs] = Type.sections(Article)
  const data = tabs[Section.Data] as TabsSection
  test.equal(data.types.map(Type.label), [
    'Document',
    'SEO',
    'Details',
    'Planning'
  ])
  test.throws(
    () =>
      document('Article', {
        fields: {start: text('Start')},
        tabs: {planning: tab('Planning', {fields: {start: text('Start')}})}
      }),
    'Field "start" is defined twice'
  )
})
