import {Section} from '#/core/Section.js'
import {Type, type} from '#/core/Type.js'
import {check} from '#/field/check.js'
import {DisclosureSection, disclosure} from '#/field/disclosure/Disclosure.js'
import {text} from '#/field/text.js'
import {expect, test} from 'bun:test'

test('disclosure groups fields without changing their storage shape', () => {
  const formField = type('Form field', {
    fields: {
      ...disclosure('Field settings', {
        initiallyExpanded: true,
        fields: {
          label: text('Form label'),
          required: check('Required')
        }
      })
    }
  })

  expect(Object.keys(Type.fields(formField))).toEqual(['label', 'required'])
  const [settings] = Type.sections(formField)
  const data = settings[Section.Data] as DisclosureSection
  expect(data.label).toBe('Field settings')
  expect(data.initiallyExpanded).toBe(true)
})
