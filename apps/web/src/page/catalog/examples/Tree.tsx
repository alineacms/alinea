'use client'

import {Badge, Tree, TreeItem} from 'alinea/components'
import {LucideFile, LucideFolder} from 'alinea/dashboard/icons'

export function TreeExample() {
  return (
    <Tree
      aria-label="Pages"
      defaultExpandedKeys={['products']}
      selectionMode="single"
      defaultSelectedKeys={new Set(['shirt'])}
      style={{width: 280}}
    >
      <TreeItem id="home" title="Home" icon={LucideFile} />
      <TreeItem id="products" title="Products" icon={LucideFolder}>
        <TreeItem id="shirt" title="Linen shirt" icon={LucideFile} />
        <TreeItem
          id="chair"
          title="Oak dining chair"
          icon={LucideFile}
          suffix={
            <Badge size="sm" status="draft">
              Draft
            </Badge>
          }
        />
      </TreeItem>
      <TreeItem id="journal" title="Journal" icon={LucideFolder} />
    </Tree>
  )
}
