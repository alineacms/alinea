import {outcome} from '@alinea/core/Outcome'
import {createRequire} from 'node:module'

const require = createRequire(import.meta.url)

export function ensureReact() {
  const hasReact = outcome.succeeds(
    () => require.resolve('react') && require.resolve('react-dom')
  )
  if (!hasReact) {
    console.error(
      `We could not find the react package. It's required for the alinea dashboard.\nYou can install it with: npm i react react-dom`
    )
    process.exit(1)
  }
}
