import {atom} from 'jotai'
import type {ComponentType} from 'react'
import {viewsAtom} from './CoreAtoms.js'
import {dispense} from './AtomUtils.js'

export const viewAtom = dispense(key => {
  return atom((get): ComponentType | undefined => {
    return get(viewsAtom)[key]
  })
})
