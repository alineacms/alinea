import {suite} from '@alinea/suite'
import type {Config} from './Config.js'
import {defaultLoader, loaderFor} from './Loader.js'
import {JsonLoader} from './loader/JsonLoader.js'
import {YamlLoader} from './loader/YamlLoader.js'

const test = suite(import.meta)

test('loaderFor selects the loader by file extension', () => {
  test.is(loaderFor('pages/a.json'), JsonLoader)
  test.is(loaderFor('pages/a.draft.JSON'), JsonLoader)
})

test('defaultLoader follows the contentFormat option', () => {
  test.is(defaultLoader({} as Config), JsonLoader)
  test.is(defaultLoader({contentFormat: 'json'} as Config), JsonLoader)
  test.is(defaultLoader({contentFormat: 'yaml'} as Config), YamlLoader)
})

test('defaultLoader rejects an unknown contentFormat', () => {
  test.throws(
    () => defaultLoader({contentFormat: 'toml'} as unknown as Config),
    'Unknown contentFormat "toml" in the Alinea config, expected json or yaml'
  )
})

test('loaderFor rejects unknown extensions', () => {
  test.throws(() => loaderFor('pages/a.txt'), 'Unsupported content file')
  test.throws(() => loaderFor('pages/a'), 'Unsupported content file')
})
