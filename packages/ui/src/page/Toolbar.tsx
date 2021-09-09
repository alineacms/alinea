import React from 'react'
import {Logo} from '../branding/Logo'

export function Toolbar() {
  return (
    <div
      style={{
        width: '100%',
        padding: '8px 10px',
        borderBottom: '1px solid #595959'
      }}
    >
      <Logo>a</Logo>
    </div>
  )
}
