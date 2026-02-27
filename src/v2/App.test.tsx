import {expect, test} from 'bun:test'
import {Config, Field} from 'alinea'
import {createCMS} from 'alinea/core'
import {render, screen, waitFor} from '@testing-library/react'
import './dom'
import {App} from './App'

const Page = Config.document('Page', {
  fields: {
    title: Field.text('Title')
  }
})

const cms = createCMS({
  schema: {Page},
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content',
      roots: {
        pages: Config.root('Pages')
      }
    })
  }
})

test('renders the v2 dashboard shell', async () => {
  render(<App config={cms.config} client={undefined as any} views={{}} />)
  expect(screen.getByText('Dashboard v2')).toBeDefined()
  await waitFor(() => {
    expect(screen.getByText(/Select an entry from the left/)).toBeDefined()
  })
})
