import {suite} from '@alinea/suite'
import {render, screen} from '@testing-library/react'
import {WorkspaceMenu} from './WorkspaceMenu.js'

const test = suite(import.meta)

test('renders selected workspace in trigger button', () => {
  render(
    <WorkspaceMenu
      items={[
        {id: 'simple', label: 'Simple'},
        {id: 'nested', label: 'Nested'}
      ]}
      selectedWorkspace="simple"
      onSelectWorkspace={function onSelectWorkspace() {}}
    />
  )

  test.is(Boolean(screen.getByRole('button', {name: /simple/i})), true)
})
