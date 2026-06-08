import {cleanup, fireEvent, render, screen} from '#test/react.js'
import {atom} from 'jotai'
import {afterEach, expect, test} from 'bun:test'
import type {DashboardRoot} from '../store/Dashboard.js'
import {LocaleMenu} from './LocaleMenu.js'

afterEach(cleanup)

test('LocaleMenu displays uppercase locale codes and muted language names', () => {
  const root = {
    i18n: atom({locales: ['en-US', 'fr', 'not a locale']}),
    selectedLocale: atom<string | null>('en-US')
  } as unknown as DashboardRoot
  render(<LocaleMenu root={root} />)

  expect(
    screen.getByRole('button', {name: 'EN-US English (United States)'})
  ).toBeDefined()

  fireEvent.click(screen.getByRole('button'))

  expect(
    screen.getByRole('menuitemradio', {
      name: 'EN-US English (United States)'
    })
  ).toBeDefined()
  expect(screen.getByRole('menuitemradio', {name: 'FR French'})).toBeDefined()
  expect(
    screen.getByRole('menuitemradio', {name: 'not a locale'})
  ).toBeDefined()
})
