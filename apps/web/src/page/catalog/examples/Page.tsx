'use client'

import {
  Badge,
  Button,
  Page,
  PageActions,
  PageBack,
  PageContent,
  PageFooter,
  PageHeader,
  PageTitle,
  TextField
} from 'alinea/components'

export function PageExample() {
  return (
    <div style={{display: 'flex', width: 560, height: 320}}>
      <Page>
        <PageHeader>
          <PageBack label="Back to Products" />
          <PageTitle>Linen shirt</PageTitle>
          <Badge status="draft">Draft</Badge>
          <PageActions>
            <Button color="primary">Publish</Button>
          </PageActions>
        </PageHeader>
        <PageContent contained style={{padding: 16}}>
          <TextField label="Title" defaultValue="Linen shirt" />
        </PageContent>
        <PageFooter>
          <Button variant="outline">Cancel</Button>
          <Button>Save</Button>
        </PageFooter>
      </Page>
    </div>
  )
}
