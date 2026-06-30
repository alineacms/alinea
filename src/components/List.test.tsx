import {cleanup, render, screen} from '#test/react.js'
import {afterEach, expect, test} from 'bun:test'
import {List, ListItem} from './List.js'

afterEach(cleanup)

test('List renders rows on the public list roles', () => {
  render(
    <List aria-label="Sections">
      <ListItem role="listitem">Hero</ListItem>
      <ListItem role="listitem">Quote</ListItem>
    </List>
  )

  expect(screen.getByRole('list', {name: 'Sections'})).toBeTruthy()
  expect(screen.getAllByRole('listitem')).toHaveLength(2)
})

test('ListItem renders leading, trailing and inner content', () => {
  render(
    <List>
      <ListItem leading="A" trailing="B" inner="Nested details">
        Title
      </ListItem>
    </List>
  )

  expect(screen.getByText('A')).toBeTruthy()
  expect(screen.getByText('Title')).toBeTruthy()
  expect(screen.getByText('B')).toBeTruthy()
  expect(screen.getByText('Nested details')).toBeTruthy()
})
