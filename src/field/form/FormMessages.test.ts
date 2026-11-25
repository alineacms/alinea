import {expect, test} from 'bun:test'
import {translate} from './FormMessages.js'

test('messages are in the language of the locale', () => {
  expect(translate('nl')({code: 'tooLong', max: 3})).toBe(
    'Gebruik hoogstens 3 tekens'
  )
  expect(translate('fr')({code: 'required'})).toBe('Remplissez ce champ')
  expect(translate('de')({code: 'required'})).toBe('Füllen Sie dieses Feld aus')
})

test('a locale falls back to its language, then english', () => {
  expect(translate('nl-BE')({code: 'required'})).toBe('Vul dit veld in')
  expect(translate('es')({code: 'required'})).toBe('Fill in this field')
  expect(translate(null)({code: 'tooFewItems', min: 1})).toBe(
    'Add at least 1 item'
  )
})

test('texts are shown as is', () => {
  expect(translate('nl')('Choose 1 to 5')).toBe('Choose 1 to 5')
})

test('messages replace or add texts', () => {
  const text = translate('nl-BE', {
    nl: {tooLong: ({max}) => `Maximaal ${max} tekens`},
    'nl-be': {required: 'Graag invullen'}
  })
  expect(text({code: 'tooLong', max: 3})).toBe('Maximaal 3 tekens')
  expect(text({code: 'required'})).toBe('Graag invullen')
  expect(text({code: 'invalidDate'})).toBe('Gebruik een geldige datum')
  const es = translate('es', {es: {required: 'Rellena este campo'}})
  expect(es({code: 'required'})).toBe('Rellena este campo')
  expect(es({code: 'invalidDate'})).toBe('Use a valid date')
})
