'use client'

import {ComboBox, ComboBoxGroup, ComboBoxItem} from 'alinea/components'
import {
  IcRoundDescription,
  IcRoundFeed,
  IcRoundImage
} from 'alinea/dashboard/icons'

export function ComboBoxGroupsExample() {
  return (
    <ComboBox label="Link to" style={{width: 280}}>
      <ComboBoxGroup label="Pages">
        <ComboBoxItem value="about" icon={IcRoundDescription}>
          About us
        </ComboBoxItem>
        <ComboBoxItem
          value="collection"
          icon={IcRoundImage}
          description="Products of the summer collection"
        >
          Summer collection
        </ComboBoxItem>
      </ComboBoxGroup>
      <ComboBoxGroup label="Blog">
        <ComboBoxItem
          value="care"
          icon={IcRoundFeed}
          description="Published last week"
        >
          Caring for linen
        </ComboBoxItem>
      </ComboBoxGroup>
    </ComboBox>
  )
}
