import {createId} from 'alinea/core/Id'
import React, {useMemo} from 'react'

export function useId() {
  return 'useId' in React ? React.useId() : useMemo(createId, [])
}
