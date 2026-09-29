'use client'

import {Tabs, TabsList, TabsTrigger} from 'alinea/components'

const variants = ['line', 'subtle', 'enclosed'] as const

export function TabsVariantsExample() {
  return (
    <div style={{display: 'grid', gap: 24}}>
      {variants.map(variant => (
        <Tabs key={variant} variant={variant} defaultValue="all">
          <TabsList aria-label={`Filter, ${variant}`}>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="published">Published</TabsTrigger>
            <TabsTrigger value="drafts">Drafts</TabsTrigger>
          </TabsList>
        </Tabs>
      ))}
    </div>
  )
}
