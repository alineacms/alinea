import {expect, test} from 'bun:test'
import {object} from '#/field/object/ObjectField.js'
import {text} from '#/field/text/TextField.js'
import {getScope} from './Scope.js'
import {type} from './Type.js'

const Page = type('Page', {
  fields: {
    title: text('Title'),
    seo: object('SEO', {
      fields: {meta: object('Meta', {fields: {title: text('Title')}})}
    })
  }
})
const scope = getScope({schema: {Page}, workspaces: {}})

test('fields of object fields have a data path', () => {
  expect(scope.dataPathOf(Page.title)).toEqual(['title'])
  expect(scope.dataPathOf(Page.seo.meta.title)).toEqual([
    'seo',
    'meta',
    'title'
  ])
})

test('fields of object fields survive serialization', () => {
  const select = {title: Page.seo.meta.title}
  const parsed = scope.parse<typeof select>(scope.stringify(select))
  expect(parsed.title).toBe(Page.seo.meta.title)
})
