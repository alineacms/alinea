import {Button, Select, SelectItem, TextField} from '#/components.js'
import {getType} from '#/core/Internal.js'
import {ExplorerLocation} from '#/dashboard/store/Dashboard.js'
import {useDashboard} from '#/dashboard/store/hooks.js'
import {atom, useAtom, useAtomValue} from 'jotai'
import {useState, type FormEvent} from 'react'
import {LocationBreadcrumbs} from '../LocationBreadcrumbs.js'
import {
  DashboardModalCloseButton,
  DashboardModalDialog,
  DashboardModalForm,
  DashboardModalFormBody,
  DashboardModalFormFooter,
  DashboardModalFormHeader,
  DashboardModalTitle
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

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
  }

  return (
    <DashboardModalDialog aria-label="Create entry" variant="explorer">
      <DashboardModalForm onSubmit={onSubmit}>
        <DashboardModalFormHeader>
          <DashboardModalTitle>Create entry</DashboardModalTitle>
          <DashboardModalCloseButton />
        </DashboardModalFormHeader>
        <DashboardModalFormBody>
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
        </DashboardModalFormBody>

        <DashboardModalFormFooter>
          <Button type="submit">Create entry</Button>
        </DashboardModalFormFooter>
      </DashboardModalForm>
    </DashboardModalDialog>
  )
}
