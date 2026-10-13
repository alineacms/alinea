import {suite} from '@alinea/suite'
import {Section} from '#/core/Section.js'
import {Type, type} from '#/core/Type.js'
import {text} from '#/field/text.js'
import type {TabsSection} from '#/field/tabs/Tabs.js'
import {withSettingsTab} from './SettingsTab.js'

const test = suite(import.meta)

test('entries of a type with settings show them in a Settings tab', () => {
  const Product = type('Product', {
    fields: {name: text('Name')},
    settings: {sku: text('SKU')}
  })
  const form = withSettingsTab(Product)
  test.is(withSettingsTab(Product), form)
  const [tabs] = Type.sections(form)
  const data = tabs[Section.Data] as TabsSection
  test.equal(data.types.map(Type.label), ['Content', 'Settings'])
  test.equal(Object.keys(Section.fields(tabs)), ['name', 'sku'])
  test.is(Type.field(form, 'sku'), Type.field(Product, 'sku'))
  const plain = type('Plain', {fields: {name: text('Name')}})
  test.is(withSettingsTab(plain), plain)
})
