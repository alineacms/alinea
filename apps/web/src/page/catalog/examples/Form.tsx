'use client'

import {
  Button,
  Form,
  Select,
  SelectItem,
  Stack,
  Text,
  TextField
} from 'alinea/components'
import {useState} from 'react'

// Stands in for a request to your own API, which returns errors by field name
async function createPage(data: FormData) {
  await new Promise(resolve => setTimeout(resolve, 300))
  if (data.get('path') === 'about') return {path: 'This path is taken'}
  return undefined
}

export function FormExample() {
  const [created, setCreated] = useState<string>()
  return (
    <Form
      style={{width: 300}}
      onSubmit={async data => {
        const errors = await createPage(data)
        if (!errors) setCreated(String(data.get('title')))
        return errors
      }}
    >
      <Stack gap={16}>
        <TextField label="Title" name="title" required />
        <TextField label="Path" name="path" defaultValue="about" />
        <Select label="Type" name="type" defaultValue="page">
          <SelectItem value="page">Page</SelectItem>
          <SelectItem value="post">Blog post</SelectItem>
        </Select>
        <Button type="submit" color="primary">
          Create page
        </Button>
        {created && <Text size="sm">Created “{created}”</Text>}
      </Stack>
    </Form>
  )
}
