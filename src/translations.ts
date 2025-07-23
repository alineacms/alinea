export {default as en} from './translations/en.json' with {type: 'json'}
export {default as nl} from './translations/nl.json' with {type: 'json'}

// Compare types to en to ensure no missing keys
import type en from './translations/en.json'
import type nl from './translations/nl.json'

type Matches<A, B extends A> = true
type CheckNL = Matches<typeof en, typeof nl>
