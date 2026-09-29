'use client'

import {Tabs, TabsContent, TabsList, TabsTrigger} from 'alinea/components'

export function TabsVerticalExample() {
  return (
    <Tabs orientation="vertical" variant="subtle" defaultValue="general">
      <TabsList aria-label="Settings">
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="languages">Languages</TabsTrigger>
        <TabsTrigger value="media" disabled>
          Media
        </TabsTrigger>
      </TabsList>
      <TabsContent value="general">Site name and logo.</TabsContent>
      <TabsContent value="languages">
        English, Nederlands, Français.
      </TabsContent>
      <TabsContent value="media">Upload limits.</TabsContent>
    </Tabs>
  )
}
