'use client'

import {Checkbox} from 'alinea/components'

export function CheckboxStatesExample() {
  return (
    <div style={{display: 'grid', gap: 16, width: 280}}>
      <Checkbox>Featured product</Checkbox>
      <Checkbox defaultChecked>In stock</Checkbox>
      <Checkbox checked="indeterminate">All variants</Checkbox>
      <Checkbox disabled>Gift wrapping</Checkbox>
      <Checkbox description="Hide this page from search engines">
        No index
      </Checkbox>
      <Checkbox required error="Accept the terms to publish">
        I accept the terms
      </Checkbox>
    </div>
  )
}
