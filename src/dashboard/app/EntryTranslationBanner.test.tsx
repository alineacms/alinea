import {cleanup, fireEvent, render, screen} from '#test/react.js'
import {afterEach, expect, mock, test} from 'bun:test'
import {EntryTranslationBanner} from './EntryTranslationBanner.js'

afterEach(cleanup)

test('allows an untranslated entry to start empty', () => {
  const onCopyFromSourceChange = mock(() => {})
  render(
    <EntryTranslationBanner
      copyFromSource={false}
      parentNeedsTranslation={false}
      sourceLocale="en"
      sourceLocales={['en', 'fr']}
      onCopyFromSourceChange={onCopyFromSourceChange}
      onSourceLocaleChange={() => {}}
    />
  )

  fireEvent.click(
    screen.getByRole('checkbox', {name: 'Copy from existing translation'})
  )
  expect(onCopyFromSourceChange).toHaveBeenCalledWith(true)
})

test('shows the selected source language when copying a translation', () => {
  render(
    <EntryTranslationBanner
      copyFromSource
      parentNeedsTranslation={false}
      sourceLocale="en"
      sourceLocales={['en', 'fr']}
      onCopyFromSourceChange={() => {}}
      onSourceLocaleChange={() => {}}
    />
  )

  expect(screen.getByLabelText('Translation source language')).toBeDefined()
  expect(
    screen.queryByText(
      'Choose the existing language to copy from before creating the translation.'
    )
  ).toBeNull()
  expect(screen.queryByText('Start from')).toBeNull()
})

test('asks to translate the parent entry first', () => {
  render(
    <EntryTranslationBanner
      copyFromSource
      parentNeedsTranslation
      sourceLocale="en"
      sourceLocales={['en', 'fr']}
      onCopyFromSourceChange={() => {}}
      onSourceLocaleChange={() => {}}
    />
  )

  const banner = screen.getByRole('status')
  expect(banner.dataset.variant).toBe('warning')
  expect(
    screen.getByText(
      'Translate the parent entry first before creating this translation.'
    )
  ).toBeDefined()
  expect(screen.queryByRole('checkbox')).toBeNull()
})
