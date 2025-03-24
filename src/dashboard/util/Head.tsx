import type {PropsWithChildren} from 'react'
import {createPortal} from 'react-dom'

export function Head({children}: PropsWithChildren<{}>) {
  return createPortal(children, document.head)
}
