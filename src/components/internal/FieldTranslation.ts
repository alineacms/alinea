import {createContext} from 'react'

/**
 * The other languages that have a value the field misses in the language
 * being edited, set by the dashboard around each field
 */
export const FieldMissingIn = createContext<ReadonlyArray<string> | null>(null)
