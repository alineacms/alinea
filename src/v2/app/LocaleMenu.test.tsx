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

const {LocaleMenu} = await import('./LocaleMenu.js')

const test = suite(import.meta)

test('hides locale menu when root has 0 or 1 locale', () => {
  const {rerender} = render(
    <LocaleMenu
      locales={[]}
      selectedLocale={undefined}
      onSelectLocale={function onSelectLocale() {}}
    />
  )
  test.is(screen.queryByRole('button', {name: 'Language'}), null)

  rerender(
    <LocaleMenu
      locales={['en']}
      selectedLocale="en"
      onSelectLocale={function onSelectLocale() {}}
    />
  )
  test.is(screen.queryByRole('button', {name: 'Language'}), null)
})

test('renders locale menu and emits selected locale', async () => {
  let selected: string | undefined
  render(
    <LocaleMenu
      locales={['en', 'fr', 'de']}
      selectedLocale="en"
      onSelectLocale={locale => {
        selected = locale
      }}
    />
  )

  fireEvent.click(screen.getByText('FR'))
  test.is(selected, 'fr')
})
