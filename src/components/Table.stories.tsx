import {useMemo, useState} from 'react'
import {IcRoundDelete, IcRoundEdit} from '../dashboard/icons.js'
import {Button} from './Button.js'
import {Icon} from './Icon.js'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from './Table.js'
import type {Selection as SelectionKeys, SortDescriptor} from './types.js'

interface FileItem {
  id: string
  name: string
  type: string
  modified: string
}

const columns = [
  {id: 'name', title: 'Name'},
  {id: 'type', title: 'Type'},
  {id: 'modified', title: 'Date modified'}
] as const

const files: Array<FileItem> = [
  {id: 'games', name: 'Games', type: 'File folder', modified: '2020-06-07'},
  {
    id: 'program-files',
    name: 'Program Files',
    type: 'File folder',
    modified: '2021-04-07'
  },
  {id: 'bootmgr', name: 'bootmgr', type: 'System file', modified: '2010-11-20'},
  {id: 'users', name: 'Users', type: 'File folder', modified: '2021-08-15'},
  {
    id: 'windows',
    name: 'Windows',
    type: 'Operating system',
    modified: '2021-05-05'
  }
]

function FileHeader() {
  return (
    <TableHeader>
      {columns.map(column => (
        <TableHead
          key={column.id}
          id={column.id}
          rowHeader={column.id === 'name'}
        >
          {column.title}
        </TableHead>
      ))}
    </TableHeader>
  )
}

function renderFile(file: FileItem) {
  return (
    <TableRow id={file.id}>
      <TableCell nowrap>{file.name}</TableCell>
      <TableCell nowrap>{file.type}</TableCell>
      <TableCell nowrap>{file.modified}</TableCell>
    </TableRow>
  )
}

export function Example() {
  return (
    <Table aria-label="Files">
      <FileHeader />
      <TableBody items={files}>{renderFile}</TableBody>
    </Table>
  )
}

export function Striped() {
  return (
    <Table aria-label="Files" striped>
      <FileHeader />
      <TableBody items={files}>{renderFile}</TableBody>
    </Table>
  )
}

export function Empty() {
  return (
    <Table aria-label="Files">
      <FileHeader />
      <TableBody renderEmptyState={() => 'No files found.'}>{[]}</TableBody>
    </Table>
  )
}

export function Static() {
  return (
    <Table aria-label="Actions" style={{width: 'auto'}}>
      <TableHeader>
        <TableHead rowHeader>Name</TableHead>
        <TableHead width={120}>Actions</TableHead>
      </TableHeader>
      <TableBody>
        <TableRow id="readme">
          <TableCell>readme.md</TableCell>
          <TableCell nowrap>
            <Button size="icon" variant="ghost" aria-label="Edit">
              <Icon icon={IcRoundEdit} />
            </Button>
            <Button size="icon" variant="ghost" aria-label="Delete">
              <Icon icon={IcRoundDelete} />
            </Button>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}

export function Selection() {
  const [single, setSingle] = useState<SelectionKeys>(new Set(['games']))
  const [multiple, setMultiple] = useState<SelectionKeys>(new Set())
  const [action, setAction] = useState<string>()
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 24}}>
      <Table
        aria-label="Single selection"
        selectionMode="single"
        selectedKeys={single}
        onSelectionChange={setSingle}
        disabledKeys={['bootmgr']}
      >
        <FileHeader />
        <TableBody items={files}>{renderFile}</TableBody>
      </Table>
      <Table
        aria-label="Multiple selection"
        selectionMode="multiple"
        selectedKeys={multiple}
        onSelectionChange={setMultiple}
        onRowAction={key => setAction(String(key))}
        striped
      >
        <FileHeader />
        <TableBody items={files}>{renderFile}</TableBody>
      </Table>
      <output data-testid="selected">
        {multiple === 'all' ? 'all' : [...multiple].join(',')}
      </output>
      <output data-testid="action">{action}</output>
    </div>
  )
}

export function Sorting() {
  const [sort, setSort] = useState<SortDescriptor>({
    column: 'name',
    direction: 'asc'
  })
  const sorted = useMemo(() => {
    const column = sort.column as keyof FileItem
    const result = files.toSorted((a, b) => a[column].localeCompare(b[column]))
    return sort.direction === 'asc' ? result : result.reverse()
  }, [sort])
  return (
    <Table
      aria-label="Sorted files"
      sortDescriptor={sort}
      onSortChange={setSort}
    >
      <TableHeader>
        {columns.map(column => (
          <TableHead
            key={column.id}
            id={column.id}
            rowHeader={column.id === 'name'}
            sortable
          >
            {column.title}
          </TableHead>
        ))}
      </TableHeader>
      <TableBody items={sorted}>{renderFile}</TableBody>
    </Table>
  )
}

export default {
  title: 'Pure components / Table'
}
