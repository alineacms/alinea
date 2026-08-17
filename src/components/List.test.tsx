import {cleanup, fireEvent, render, screen} from '#test/react.js'
import {afterEach, expect, mock, test} from 'bun:test'
import {
  List,
  ListEmpty,
  ListItem,
  ListItemDescription,
  ListItemTitle,
  ListItemVisual
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

function EmptyIcon() {
  return <svg data-testid="empty-icon" />
}
