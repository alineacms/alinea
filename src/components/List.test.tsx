import {cleanup, fireEvent, render, screen} from '#test/react.js'
import {afterEach, expect, mock, test} from 'bun:test'
import {
  List,
  ListCreateButton,
  ListEmpty,
  ListItem,
  ListItemDescription,
  ListItemTitle,
  ListItemVisual,
  ListLabel,
  ListRowHeader,
  ListRowType,
  ListTypeIcon
} from './List.js'

afterEach(cleanup)

test('List renders rows on the public list roles', () => {
  render(
    <List aria-label="Sections">
      <ListItem>Hero</ListItem>
      <ListItem>Quote</ListItem>
    </List>
  )

  expect(screen.getByRole('list', {name: 'Sections'})).toBeTruthy()
  expect(screen.getAllByRole('listitem')).toHaveLength(2)
})

test('ListItem renders leading, trailing and inner content', () => {
  render(
    <List>
      <ListItem
        leading={<ListItemVisual>A</ListItemVisual>}
        trailing="B"
        inner="Nested details"
      >
        <ListItemTitle>Title</ListItemTitle>
        <ListItemDescription>Description</ListItemDescription>
      </ListItem>
    </List>
  )

  expect(screen.getByText('A')).toBeTruthy()
  expect(screen.getByText('Title')).toBeTruthy()
  expect(screen.getByText('Description')).toBeTruthy()
  expect(screen.getByText('B')).toBeTruthy()
  expect(screen.getByText('Nested details')).toBeTruthy()
})

test('ListItem renders its content as a button when it is actionable', () => {
  const onPress = mock(() => undefined)
  render(
    <List>
      <ListItem onPress={onPress}>
        <ListItemTitle>Open entry</ListItemTitle>
      </ListItem>
    </List>
  )

  fireEvent.click(screen.getByRole('button', {name: 'Open entry'}))

  expect(onPress).toHaveBeenCalledTimes(1)
})

test('ListEmpty describes an empty list', () => {
  render(
    <List empty>
      <ListEmpty icon={EmptyIcon} title="No results">
        Try another filter.
      </ListEmpty>
    </List>
  )

  expect(screen.getByTestId('empty-icon')).toBeTruthy()
  expect(screen.getByRole('status').textContent).toBe(
    'No resultsTry another filter.'
  )
})

test('ListLabel shows its count and exposes a separate fold action', () => {
  const onPress = mock(() => undefined)
  render(
    <ListLabel
      aria-label="Collapse all sections"
      count={3}
      expanded
      hasRows
      onPress={onPress}
    >
      Sections
    </ListLabel>
  )

  expect(screen.getByText('Sections')).toBeTruthy()
  expect(screen.getByText('3')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', {name: 'Collapse all sections'}))
  expect(onPress).toHaveBeenCalledTimes(1)
})

test('ListLabel hides the fold action for an empty list', () => {
  render(
    <ListLabel count={0} expanded={false} hasRows={false}>
      Empty list
    </ListLabel>
  )

  expect(screen.getByText('Empty list')).toBeTruthy()
  expect(screen.queryByRole('button')).toBeNull()
})

test('ListLabel exposes a separate add action', () => {
  const onAdd = mock(() => undefined)
  const onPress = mock(() => undefined)
  render(
    <ListLabel
      addLabel="Add block"
      aria-label="Collapse all blocks"
      count={2}
      expanded
      hasRows
      onAdd={onAdd}
      onPress={onPress}
    >
      Blocks
    </ListLabel>
  )

  fireEvent.click(screen.getByRole('button', {name: 'Add block'}))
  expect(onAdd).toHaveBeenCalledTimes(1)
  expect(onPress).not.toHaveBeenCalled()
})

test('ListRowHeader toggles from the bar but not from its controls', () => {
  const onToggle = mock(() => undefined)
  render(
    <ListRowHeader onToggle={onToggle}>
      <span>Row label</span>
      <button type="button">Settings</button>
    </ListRowHeader>
  )

  fireEvent.click(screen.getByText('Row label'))
  fireEvent.click(screen.getByRole('button', {name: 'Settings'}))

  expect(onToggle).toHaveBeenCalledTimes(1)
})

test('ListRowType derives a stable color from its name', () => {
  render(
    <div>
      <ListRowType icon={EmptyIcon}>Text</ListRowType>
      <ListRowType icon={EmptyIcon}>Text</ListRowType>
      <ListRowType icon={EmptyIcon}>Intro</ListRowType>
    </div>
  )

  const rows = screen.getAllByText(/Text|Intro/).map(node => node.parentElement)
  expect(rows[0]?.dataset.color).toBe(rows[1]?.dataset.color)
  expect(rows[0]?.dataset.color).not.toBe(rows[2]?.dataset.color)
})

test('ListCreateButton shares its type color with the matching row', () => {
  render(
    <div>
      <ListRowType icon={EmptyIcon}>Text</ListRowType>
      <ListCreateButton icon={EmptyIcon} name="Text">
        Text
      </ListCreateButton>
    </div>
  )

  const row = screen.getAllByText('Text')[0]?.parentElement
  const create = screen.getByRole('button', {name: 'Text'})
  expect(row?.dataset.color).toBe(create.dataset.color)
})

test('ListTypeIcon shares its type color with the matching row', () => {
  render(
    <div>
      <ListRowType icon={EmptyIcon}>Programs</ListRowType>
      <ListTypeIcon icon={EmptyIcon} name="Programs" />
    </div>
  )

  const row = screen.getByText('Programs').parentElement
  const pickerIcon = screen.getAllByTestId('empty-icon')[1]?.parentElement
  expect(row?.dataset.color).toBe(pickerIcon?.dataset.color)
})

function EmptyIcon() {
  return <svg data-testid="empty-icon" />
}
