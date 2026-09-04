import {suite} from '@alinea/suite'
import {withAlinea} from './with-alinea.js'

const test = suite(import.meta)

test('inlines CLI routing settings into the Next config', () => {
  const config = withAlinea({
    env: {
      EXISTING_VALUE: 'preserved',
      ALINEA_ADMIN_PATH: 'admin'
    }
  })

  test.equal(config.env, {
    EXISTING_VALUE: 'preserved',
    ALINEA_ADMIN_PATH: '/admin'
  })
})
