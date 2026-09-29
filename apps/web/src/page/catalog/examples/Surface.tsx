'use client'

import {
  Button,
  Surface,
  SurfaceContent,
  SurfaceHeader,
  SurfaceRow,
  Text
} from 'alinea/components'

export function SurfaceExample() {
  return (
    <Surface aria-label="Shipping" role="region" style={{width: 360}}>
      <SurfaceHeader>
        <Text weight="semibold">Shipping</Text>
      </SurfaceHeader>
      <SurfaceContent>
        <Text color="muted">Free delivery on orders over €150.</Text>
        <Surface>
          <SurfaceRow>
            <Text style={{flex: 1}}>Belgium · 2 days</Text>
            <Button variant="ghost" size="sm">
              Edit
            </Button>
          </SurfaceRow>
        </Surface>
      </SurfaceContent>
    </Surface>
  )
}
