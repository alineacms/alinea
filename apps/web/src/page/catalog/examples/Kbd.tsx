'use client'

import {Kbd, Text} from 'alinea/components'

export function KbdExample() {
  return (
    <>
      <Kbd>⌘ K</Kbd>
      <Kbd size="sm">Esc</Kbd>
      <Text>
        Save a draft with <Kbd>⌘</Kbd> <Kbd>S</Kbd>
      </Text>
    </>
  )
}
