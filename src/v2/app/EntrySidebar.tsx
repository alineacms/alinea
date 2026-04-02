import {Button, Icon, Tab, TabList, TabPanel, Tabs} from '@alinea/components'
import {styler} from '@alinea/styler'
import {useAtom, useAtomValue, useSetAtom} from 'jotai'
import {IcRoundHistory, IcRoundVisibility} from '../icons.js'
import {DashboardEntry} from '../store.js'
import css from './EntrySidebar.module.css'
import {Sidebar, SidebarBody, SidebarHeader} from './ui/Sidebar.js'

const styles = styler(css)

export interface EntrySidebarProps {
  entry: DashboardEntry
}

export function EntrySidebar({entry}: EntrySidebarProps) {
  const editor = useAtomValue(entry.editor)
  const isEditing = useAtomValue(editor.node.isDirty)
  const reset = useSetAtom(editor.node.reset)
  const statuses = useAtomValue(entry.availableStatuses)
  const [selectedStatus, setSelectedStatus] = useAtom(entry.selectedStatus)
  return (
    <Sidebar>
      <Tabs defaultSelectedKey="history" variant="subtle">
        <SidebarHeader>
          <TabList aria-label="Entry sidebar">
            <Tab id="history">
              <Icon icon={IcRoundHistory} />
              History
            </Tab>
            <Tab id="preview">
              <Icon icon={IcRoundVisibility} />
              Preview
            </Tab>
          </TabList>
        </SidebarHeader>

        <SidebarBody>
          <TabPanel id="history">
            {isEditing ? (
              <>
                Editing
                <Button onPress={reset}>Discard changes</Button>
              </>
            ) : (
              'Not editing'
            )}
            <ul>
              {statuses.map(status => {
                return (
                  <li key={status}>
                    <Button onPress={() => setSelectedStatus(status)}>
                      {status}
                    </Button>
                  </li>
                )
              })}
            </ul>
          </TabPanel>
          <TabPanel id="preview">Preview placeholder</TabPanel>
        </SidebarBody>
      </Tabs>
    </Sidebar>
  )
}
