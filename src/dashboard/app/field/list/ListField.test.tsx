import {suite} from '@alinea/suite'
import '#/dashboard/dom.js'
import {cleanup, fireEvent, render} from '@testing-library/react'
import {act} from 'react'
import {Example} from './ListField.stories.js'
import {insertIndex, reorderIndex} from './ListField.view.js'

const test = suite(import.meta, {
  afterEach() {
    cleanup()
  }
})

test('insertIndex maps row separators to array insertion indexes', () => {
  test.equal(insertIndex(0, 'before'), 0)
  test.equal(insertIndex(0, 'after'), 1)
  test.equal(insertIndex(3, 'before'), 3)
  test.equal(insertIndex(3, 'after'), 4)
})

test('reorderIndex maps separator drop targets to move indexes', () => {
  test.equal(reorderIndex(1, 0), 0)
  test.equal(reorderIndex(1, 2), 1)
  test.equal(reorderIndex(1, 3), 2)
  test.equal(reorderIndex(3, 1), 1)
})

test('renders draggable row headers and reorders rows on drop', async () => {
  const view = render(<Example />)

  const before = view
    .getAllByLabelText(/^Drag /)
    .map(element => element.getAttribute('aria-label'))
  test.equal(before, [
    'Drag Hero item 1',
    'Drag Quote item 2',
    'Drag FAQ Item item 3'
  ])

  const quoteDragHandle = view.getByLabelText('Drag Quote item 2')
  test.is(quoteDragHandle.getAttribute('draggable'), 'true')

  const moveBeforeHero = view.getByLabelText('Move block before Hero')
  const dataTransfer = new DataTransfer()
  Object.defineProperty(dataTransfer, 'setDragImage', {
    configurable: true,
    value() {}
  })

  await act(async () => {
    fireEvent.dragStart(quoteDragHandle, {dataTransfer})
    fireEvent.dragEnter(moveBeforeHero, {dataTransfer})
    fireEvent.dragOver(moveBeforeHero, {dataTransfer})
    fireEvent.drop(moveBeforeHero, {dataTransfer})
    await Promise.resolve()
  })

  const after = view
    .getAllByLabelText(/^Drag /)
    .map(element => element.getAttribute('aria-label'))
  test.equal(after, [
    'Drag Quote item 1',
    'Drag Hero item 2',
    'Drag FAQ Item item 3'
  ])
})

test('renders a bottom drop target and reorders rows to the end on drop', async () => {
  const view = render(<Example />)

  const heroDragHandle = view.getByLabelText('Drag Hero item 1')
  const moveAfterFaq = view.getByLabelText('Move block after FAQ Item')
  const dataTransfer = new DataTransfer()
  Object.defineProperty(dataTransfer, 'setDragImage', {
    configurable: true,
    value() {}
  })

  await act(async () => {
    fireEvent.dragStart(heroDragHandle, {dataTransfer})
    fireEvent.dragEnter(moveAfterFaq, {dataTransfer})
    fireEvent.dragOver(moveAfterFaq, {dataTransfer})
    fireEvent.drop(moveAfterFaq, {dataTransfer})
    await Promise.resolve()
  })

  const after = view
    .getAllByLabelText(/^Drag /)
    .map(element => element.getAttribute('aria-label'))
  test.equal(after, [
    'Drag Quote item 1',
    'Drag FAQ Item item 2',
    'Drag Hero item 3'
  ])
})

test('marks only the first row header as the first row', () => {
  const view = render(<Example />)

  const rowItems = view.getAllByRole('listitem')
  const firstHeader = rowItems[0]?.querySelector('header')
  const secondHeader = rowItems[1]?.querySelector('header')

  test.is(firstHeader?.getAttribute('data-first-row'), 'true')
  test.is(secondHeader?.getAttribute('data-first-row'), null)
})

test('blurs the separator trigger after selecting a new row', async () => {
  const view = render(<Example />)

  const addBeforeHero = view.getByLabelText('Add Hero before')

  await act(async () => {
    fireEvent.click(addBeforeHero)
    await Promise.resolve()
  })

  const quoteOption = view.getByRole('option', {name: 'Quote'})

  await act(async () => {
    fireEvent.click(quoteOption)
    await new Promise(resolve => globalThis.setTimeout(resolve, 0))
  })

  test.is(document.activeElement === addBeforeHero, false)
})

test('can add a block type with non-text fields', async () => {
  const view = render(<Example />)

  const moreTypes = view.getByLabelText('More block types')

  await act(async () => {
    fireEvent.click(moreTypes)
    await Promise.resolve()
  })

  const featureGridOption = view.getByRole('option', {name: 'Feature Grid'})

  await act(async () => {
    fireEvent.click(featureGridOption)
    await Promise.resolve()
  })

  test.equal(view.getByText('Columns').tagName, 'LABEL')
  test.equal(view.getByText('Eyebrow').tagName, 'LABEL')
})

test('shows the copied block in the footer more menu', async () => {
  const view = render(<Example />)

  await act(async () => {
    fireEvent.click(view.getByLabelText('Copy Hero'))
    await Promise.resolve()
  })

  await act(async () => {
    fireEvent.click(view.getByLabelText('More block types'))
    await Promise.resolve()
  })

  test.ok(Boolean(view.getByRole('option', {name: 'Paste Hero block'})))
})
