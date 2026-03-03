import {suite} from '@alinea/suite'
import {render, screen} from '@testing-library/react'
import {LocaleMenu} from './LocaleMenu.js'

const test = suite(import.meta)

test('hides locale menu when root has 0 or 1 locale', () => {
  const {rerender} = render(
    <LocaleMenu
      locales={[]}
      selectedLocale={undefined}
      onSelectLocale={function onSelectLocale() {}}
    />
  )
  test.is(screen.queryByRole('button'), null)

  rerender(
    <LocaleMenu
      locales={['en']}
      selectedLocale="en"
      onSelectLocale={function onSelectLocale() {}}
    />
  )
  test.is(screen.queryByRole('button'), null)
})

test('renders selected locale in trigger button', () => {
  render(
    <LocaleMenu
      locales={['en', 'fr', 'de']}
      selectedLocale="en"
      onSelectLocale={function onSelectLocale() {}}
    />
  )
  test.is(Boolean(screen.getByRole('button', {name: 'EN'})), true)
})
