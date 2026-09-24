'use client'

import {Tag, TagGroup} from 'alinea/components'

export function TagGroupExample() {
  return (
    <TagGroup
      label="Tags"
      selectionMode="multiple"
      defaultSelectedKeys={new Set(['linen'])}
    >
      <Tag id="linen">Linen</Tag>
      <Tag id="bedroom">Bedroom</Tag>
      <Tag id="summer">Summer</Tag>
      <Tag id="sale">Sale</Tag>
    </TagGroup>
  )
}
