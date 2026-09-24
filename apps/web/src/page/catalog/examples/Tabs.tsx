'use client'

import {Tabs, TabsContent, TabsList, TabsTrigger} from 'alinea/components'

export function TabsExample() {
  return (
    <Tabs defaultValue="document">
      <TabsList aria-label="Entry">
        <TabsTrigger value="document">Document</TabsTrigger>
        <TabsTrigger value="metadata">Metadata</TabsTrigger>
        <TabsTrigger value="history">History</TabsTrigger>
      </TabsList>
      <TabsContent value="document">The fields of the entry.</TabsContent>
      <TabsContent value="metadata">
        Title and description for search.
      </TabsContent>
      <TabsContent value="history">Earlier versions of the entry.</TabsContent>
    </Tabs>
  )
}
