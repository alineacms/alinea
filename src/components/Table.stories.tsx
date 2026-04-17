import type {SelectionBehavior, SelectionMode} from '@react-types/shared'
import {useAsyncList} from 'react-stately'
import {Stack} from '../stories/Stack.tsx'
import {IcRoundDelete} from '../stories/icons/IcRoundDelete.tsx'
import {IcRoundEdit} from '../stories/icons/IcRoundEdit.tsx'
import {Button} from './Button.tsx'
import {Icon} from './Icon.tsx'
import {Cell, Column, Row, Table, TableBody, TableHeader} from './Table.tsx'

const exampleStories = [
  {label: 'Table - autowidth (custom style)', props: {style: {width: 'auto'}}},
  {label: 'Table - overflow-x: auto (default)'},
  {label: 'Table - striped', props: {striped: true}}
]
export const Example = () => (
  <Stack gap={32}>
    <Table>
      {columns?.length > 0 && (
        <TableHeader>
          {columns.map(column => (
            <Column isRowHeader key={column.id}>
              {column.title}
            </Column>
          ))}
        </TableHeader>
      )}
      <TableBody renderEmptyState={() => 'No rows found.'}>[]</TableBody>
    </Table>
    {exampleStories.map((item, index) => (
      <div key={index} style={{width: '100%'}}>
        <h3>{item.label}</h3>
        <Table aria-label={item.label} {...item.props}>
          {columns?.length > 0 && (
            <TableHeader>
              {columns.map(column => (
                <Column isRowHeader key={column.id}>
                  {column.title}
                </Column>
              ))}
              {index > 0 &&
                Array.from(Array(3)).map((_, i) => (
                  <Column key={i}>Column</Column>
                ))}
            </TableHeader>
          )}
          <TableBody renderEmptyState={() => <p>No results found.</p>}>
            {items?.length > 0 &&
              items.map(item => (
                <Row key={item.id}>
                  <Cell nowrap>{item.name}</Cell>
                  <Cell nowrap>{item.type}</Cell>
                  <Cell nowrap>{item.date_modified}</Cell>
                  {index > 0 &&
                    Array.from(Array(3)).map((_, i) => (
                      <Cell key={i} style={{minWidth: 200}}>
                        Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                      </Cell>
                    ))}
                </Row>
              ))}
          </TableBody>
        </Table>
      </div>
    ))}
  </Stack>
)

const selectionStories = [
  {
    label: 'Table - single selection',
    props: {
      selectionMode: 'single' as SelectionMode,
      selectionBehavior: 'replace' as SelectionBehavior,
      striped: true
    }
  },
  {
    label: 'Table - multiple selection',
    props: {selectionMode: 'multiple' as SelectionMode, striped: true}
  }
]
export const Selection = () => (
  <Stack gap={32}>
    {selectionStories.map((item, index) => (
      <div key={index} style={{width: '100%'}}>
        <h3>{item.label}</h3>
        <Table aria-label={item.label} {...item.props}>
          {columns?.length > 0 && (
            <TableHeader>
              {columns.map(column => (
                <Column isRowHeader key={column.id}>
                  {column.title}
                </Column>
              ))}
              <Column>Actions</Column>
              {Array.from(Array(10)).map((_, i) => (
                <Column key={i}>Column</Column>
              ))}
            </TableHeader>
          )}
          <TableBody renderEmptyState={() => <p>No results found.</p>}>
            {items?.length > 0 &&
              items.map(item => (
                <Row key={item.id}>
                  <Cell nowrap>{item.name}</Cell>
                  <Cell nowrap>{item.type}</Cell>
                  <Cell nowrap>{item.date_modified}</Cell>
                  <Cell nowrap>
                    <Button
                      type="button"
                      size="square-petite"
                      appearance="outline"
                      style={{marginRight: 8}}
                    >
                      <Icon icon={IcRoundEdit} />
                    </Button>
                    <Button
                      type="button"
                      size="square-petite"
                      appearance="outline"
                    >
                      <Icon icon={IcRoundDelete} />
                    </Button>
                  </Cell>
                  {Array.from(Array(10)).map((_, i) => (
                    <Cell key={i} style={{minWidth: 200}}>
                      Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                    </Cell>
                  ))}
                </Row>
              ))}
          </TableBody>
        </Table>
      </div>
    ))}
  </Stack>
)
type TableItem = {
  id: string
  name: string
  type: string
  date_modified: string
}

export const Sorting = () => {
  const list = useAsyncList<TableItem>({
    async load() {
      return {items}
    },
    async sort({items, sortDescriptor}) {
      return {
        items: items.sort((a, b) => {
          const first = a[sortDescriptor.column as keyof TableItem]
          const second = b[sortDescriptor.column as keyof TableItem]
          let cmp =
            (Number.parseInt(first) || first) <
            (Number.parseInt(second) || second)
              ? -1
              : 1
          if (sortDescriptor.direction === 'descending') {
            cmp *= -1
          }
          return cmp
        })
      }
    }
  })
  return (
    <Table
      aria-label="Table"
      sortDescriptor={list.sortDescriptor}
      onSortChange={list.sort}
      striped
    >
      {columns?.length > 0 && (
        <TableHeader>
          {columns.map(column => (
            <Column id={column.id} isRowHeader allowsSorting key={column.id}>
              {column.title}
            </Column>
          ))}
        </TableHeader>
      )}
      <TableBody
        items={list.items}
        renderEmptyState={() => <p>No results found.</p>}
      >
        {item => (
          <Row id={item.name} key={item.id}>
            <Cell>{item.name}</Cell>
            <Cell>{item.type}</Cell>
            <Cell>{item.date_modified}</Cell>
          </Row>
        )}
      </TableBody>
    </Table>
  )
}

const columns = [
  {id: 'name', title: 'Name', allowSorting: true},
  {id: 'type', title: 'Type', allowSorting: true},
  {id: 'date_modified', title: 'Date Modified', allowSorting: true}
]

const items = [
  {id: 'games', name: 'Games', type: 'File folder', date_modified: '6/7/2020'},
  {
    id: 'program_files',
    name: 'Program Files',
    type: 'File folder',
    date_modified: '4/7/2021'
  },
  {
    id: 'bootmgr',
    name: 'Bootmgr',
    type: 'System file',
    date_modified: '11/20/2010'
  },
  {
    id: 'users',
    name: 'Users',
    type: 'File folder',
    date_modified: '8/15/2021'
  },
  {
    id: 'windows',
    name: 'Windows',
    type: 'Operating system',
    date_modified: '5/5/2021'
  },
  {
    id: 'documents',
    name: 'Documents',
    type: 'File folder',
    date_modified: '9/12/2021'
  }
]

const longitems = [
  {
    id: 'very_long_file_name_1',
    name: 'This is a very long file name that exceeds normal length 1',
    type: 'Text file',
    date_modified: '1/1/2022'
  },
  {
    id: 'very_long_file_name_2',
    name: 'This is a very long file name that exceeds normal length 2',
    type: 'Text file',
    date_modified: '2/2/2022'
  },
  {
    id: 'very_long_file_name_3',
    name: 'This is a very long file name that exceeds normal length 3',
    type: 'Text file',
    date_modified: '3/3/2022'
  },
  {
    id: 'very_long_file_name_4',
    name: 'This is a very long file name that exceeds normal length 4',
    type: 'Text file',
    date_modified: '4/4/2022'
  },
  {
    id: 'very_long_file_name_5',
    name: 'This is a very long file name that exceeds normal length 5',
    type: 'Text file',
    date_modified: '5/5/2022'
  }
]

export default {
  title: 'Components / Table'
}
