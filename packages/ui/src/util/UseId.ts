import {createId} from '@alinea/core'
import React, {useMemo} from 'react'

export function useId() {
  return 'useId' in React ? React.useId() : useMemo(createId, [])
}
