'use client'

import {Link, Text} from 'alinea/components'

export function LinkExample() {
  return (
    <Text>
      Read the <Link href="#guide">style guide</Link> or{' '}
      <Link href="#support" variant="underline">
        contact support
      </Link>
      .
    </Text>
  )
}
