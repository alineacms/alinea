import {createId} from '#/core/Id.js'
import React, {useMemo} from 'react'

export function useId() {
  return 'useId' in React ? React.useId() : useMemo(createId, [])
}
