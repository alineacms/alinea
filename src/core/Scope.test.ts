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

test('recognizes the entities of an adopted build of the config', () => {
  // After a schema change the dev server builds new types and fields, while
  // the handler of the previous build still parses queries into its own
  const build = () => {
    const Translations = type('Translations', {
      fields: {
        greeting: text('Greeting'),
        seo: object('SEO', {fields: {title: text('Title')}})
      }
    })
    return {
      Translations,
      scope: getScope({schema: {Translations}, workspaces: {}})
    }
  }
  const previous = build()
  const next = build()
  expect(next.scope.nameOf(previous.Translations)).toBeUndefined()
  next.scope.adopt(previous.scope)
  expect(next.scope.nameOf(previous.Translations)).toBe('Translations')
  expect(next.scope.dataPathOf(previous.Translations.greeting)).toEqual([
    'greeting'
  ])
  expect(next.scope.dataPathOf(previous.Translations.seo.title)).toEqual([
    'seo',
    'title'
  ])
  const query = next.scope.parse<{type: unknown}>(
    next.scope.stringify({type: previous.Translations})
  )
  expect(query.type).toBe(next.Translations)
  // The previous build does not recognize the next one
  expect(previous.scope.nameOf(next.Translations)).toBeUndefined()
})
