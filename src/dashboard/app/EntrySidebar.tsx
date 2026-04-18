import {Button, Icon, Tab, TabList, TabPanel, Tabs} from '#/components.js'
import {styler} from '@alinea/styler'
import {useAtom, useAtomValue} from 'jotai'
import {IcRoundHistory, IcRoundVisibility} from '../icons.js'
import {DashboardEntry} from '../store.js'
import css from './EntrySidebar.module.css'
import {Sidebar, SidebarBody, SidebarHeader} from './ui/Sidebar.js'

const styles = styler(css)

export interface EntrySidebarProps {
  entry: DashboardEntry
}

export function EntrySidebar({entry}: EntrySidebarProps) {
  const activeStatus = useAtomValue(entry.activeStatus)
  const currentlyEditing = useAtomValue(entry.currentlyEditing)
  const statuses = useAtomValue(entry.availableStatuses)
  const [selectedVersion, setSelectedVersion] = useAtom(entry.selectedVersion)
  return (
    <Sidebar>
      <Tabs defaultSelectedKey="history" variant="subtle">
        <SidebarHeader className={styles.EntrySidebar.header()}>
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
            <ul>
              {statuses.map(status => {
                const isEditing =
                  activeStatus == status && currentlyEditing !== undefined
                return (
                  <li key={status}>
                    <Button
                      onPress={() =>
                        setSelectedVersion({type: 'status', status})
                      }
                    >
                      {status}{' '}
                      {selectedVersion.type === 'status' &&
                      selectedVersion.status === status
                        ? 'selected'
                        : ''}{' '}
                      {isEditing ? 'editing' : ''}
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
