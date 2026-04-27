import {suite} from '@alinea/suite'
import '#/dashboard/dom.js'
import {atom, Provider} from 'jotai'
import {cleanup, render} from '@testing-library/react'
import type {DashboardEntry} from '../store/Dashboard.js'
import {EntryTranslationBanner} from './EntryTranslationBanner.js'

const test = suite(import.meta, {
  afterEach() {
    cleanup()
  }
})

interface EntryOptions {
  untranslated?: boolean
  parentNeedsTranslation?: boolean
}

function createEntry(options: EntryOptions = {}) {
  const {
    untranslated = true,
    parentNeedsTranslation = false
  } = options
  return {
    untranslated: atom(untranslated),
    parentNeedsTranslation: atom(parentNeedsTranslation),
    translationSourceLocales: atom(['en', 'de']),
    translationSourceLocale: atom('en')
  } as unknown as DashboardEntry
}

test('renders the source language picker for untranslated entries', () => {
  const view = render(
    <Provider>
      <EntryTranslationBanner entry={createEntry()} />
    </Provider>
  )

  view.getByText('This entry has not been translated yet')
  view.getByText(
    'Choose the existing language to copy from before creating the translation.'
  )
  view.getByRole('button', {name: /Translation source language/})
})

test('renders the parent translation warning when required', () => {
  const view = render(
    <Provider>
      <EntryTranslationBanner
        entry={createEntry({parentNeedsTranslation: true})}
      />
    </Provider>
  )

  view.getByText(
    'Translate the parent entry first before creating this translation.'
  )
})
