import {cleanup, fireEvent, render, screen} from '#test/react.js'
import {afterEach, expect, mock, test} from 'bun:test'
import {
  List,
  ListEmpty,
  ListItem,
  ListItemDescription,
  ListItemTitle,
  ListItemVisual,
  ListLabel
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
  const onClick = mock(() => undefined)
  render(
    <List>
      <ListItem onClick={onClick}>
        <ListItemTitle>Open entry</ListItemTitle>
      </ListItem>
    </List>
  )

  fireEvent.click(screen.getByRole('button', {name: 'Open entry'}))

  expect(onClick).toHaveBeenCalledTimes(1)
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

test('ListLabel without a fold renders the label as plain text', () => {
  render(
    <ListLabel aria-label="No links to fold" expanded={false} showFold={false}>
      Gallery
    </ListLabel>
  )

  expect(screen.queryByRole('button')).toBeNull()
  expect(screen.getByText('Gallery')).toBeTruthy()
})

test('ListLabel with a fold toggles all rows', () => {
  const onClick = mock(() => undefined)
  render(
    <ListLabel
      aria-label="Expand all items"
      expanded={false}
      hasRows
      onClick={onClick}
    >
      Sections
    </ListLabel>
  )

  fireEvent.click(screen.getByRole('button', {name: 'Expand all items'}))

  expect(onClick).toHaveBeenCalledTimes(1)
})

function EmptyIcon() {
  return <svg data-testid="empty-icon" />
}
