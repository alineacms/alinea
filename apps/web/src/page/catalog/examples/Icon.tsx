'use client'

import {Icon} from 'alinea/components'
import {
  IcRoundCheck,
  IcRoundDelete,
  IcRoundImage,
  IcRoundSearch
} from 'alinea/dashboard/icons'

export function IconExample() {
  return (
    <>
      <Icon icon={IcRoundSearch} style={{fontSize: 16}} />
      <Icon icon={IcRoundImage} style={{fontSize: 24}} />
      <Icon
        icon={IcRoundCheck}
        aria-label="Published"
        style={{fontSize: 24, color: 'var(--alinea-success)'}}
      />
      <Icon
        icon={IcRoundDelete}
        aria-label="Delete"
        style={{fontSize: 24, color: 'var(--alinea-danger)'}}
      />
    </>
  )
}
