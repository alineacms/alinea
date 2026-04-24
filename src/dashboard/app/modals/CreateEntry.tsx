import {Button, Select, SelectItem, TextField} from '#/components.js'
import {getType} from '#/core/Internal.js'
import {ExplorerLocation} from '#/dashboard/store/Dashboard.js'
import {useDashboard} from '#/dashboard/store/hooks.js'
import {atom, useAtom, useAtomValue} from 'jotai'
import {useState} from 'react'
import {LocationBreadcrumbs} from '../LocationBreadcrumbs.js'
import {
  DashboardModalContent,
  DashboardModalDialog,
  DashboardModalFooter
} from '../ui/DashboardModal.js'

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
      <DashboardModalDialog label="Create entry">
        <DashboardModalContent>
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
        </DashboardModalContent>

        <DashboardModalFooter>
          <Button>Create entry</Button>
        </DashboardModalFooter>
      </DashboardModalDialog>
    </>
  )
}
