import {Button, Select, SelectItem, TextField} from '@alinea/components'
import {getType} from '#/core/Internal.js'
import {ExplorerLocation, useDashboard} from '#/v2/store.js'
import {atom, useAtom, useAtomValue} from 'jotai'
import {useState} from 'react'
import {LocationBreadcrumbs} from '../LocationBreadcrumbs.js'
import {SheetContent, SheetDialog, SheetFooter} from '../ui/Sheet.js'

const titleAtom = atom('')

export function CreateEntry() {
  const dashboard = useDashboard()
  const workspace = useAtomValue(dashboard.selectedWorkspace)
  const root = useAtomValue(dashboard.selectedRoot)
  const {entry} = useAtomValue(dashboard.route)
  const [location, setLocation] = useState<ExplorerLocation>({
    workspace,
    root,
    parentId: entry
  })
  const [title, setTitle] = useAtom(titleAtom)
  const {schema} = useAtomValue(dashboard.config)
  return (
    <>
      <SheetDialog label="Create entry">
        <SheetContent>
          <LocationBreadcrumbs location={location} setLocation={setLocation} />

          <Select label="Type">
            {Object.entries(schema).map(([key, value]) => {
              const label = getType(value).label
              return (
                <SelectItem id={key} key={key}>
                  {label}
                </SelectItem>
              )
            })}
          </Select>
          <TextField value={title} onChange={setTitle} label="Title" />
        </SheetContent>

        <SheetFooter>
          <Button>Create entry</Button>
        </SheetFooter>
      </SheetDialog>
    </>
  )
}
