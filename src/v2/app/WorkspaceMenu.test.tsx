import {suite} from '@alinea/suite'
import {mock} from 'bun:test'
import {fireEvent, render, screen} from '@testing-library/react'
import {createContext, useContext, type ReactNode} from 'react'

const MenuActionContext = createContext<(key: string) => void>(
  function missingHandler() {}
)

mock.module('@alinea/components', function createComponentsMock() {
  interface MenuProps {
    label: string
    children: ReactNode
    onAction?: (key: string) => void
  }

  interface MenuItemProps {
    id?: string
    children: ReactNode
  }

  function Menu({label, children, onAction}: MenuProps) {
    return (
      <div>
        <button type="button">{label}</button>
        <MenuActionContext.Provider value={onAction ?? function onAction() {}}>
          {children}
        </MenuActionContext.Provider>
      </div>
    )
  }

  function MenuItem({id, children}: MenuItemProps) {
    const onAction = useContext(MenuActionContext)
    return (
      <button
        type="button"
        onClick={function onClick() {
          if (!id) return
          onAction(id)
        }}
      >
        {children}
      </button>
    )
  }

  return {Menu, MenuItem}
})

const {WorkspaceMenu} = await import('./WorkspaceMenu.js')

const test = suite(import.meta)

test('renders workspace menu and emits selected workspace id', async () => {
  let selected: string | undefined
  render(
    <WorkspaceMenu
      items={[
        {id: 'simple', label: 'Simple'},
        {id: 'nested', label: 'Nested'}
      ]}
      selectedWorkspace="simple"
      onSelectWorkspace={workspace => {
        selected = workspace
      }}
    />
  )

  fireEvent.click(screen.getByText('Nested'))
  test.is(selected, 'nested')
})
