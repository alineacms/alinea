import {Button, Icon, Tab, TabList, TabPanel, Tabs} from '#/components.js'
import {styler} from '@alinea/styler'
import {useAtom, useAtomValue} from 'jotai'
import {IcRoundHistory, IcRoundVisibility} from '../icons.js'
import {DashboardEntry} from '../store.js'
import css from './EntrySidebar.module.css'
import {EntrySidebarPreview} from './EntrySidebarPreview.js'
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
      <Tabs
        defaultSelectedKey="history"
        variant="subtle"
        className={styles.EntrySidebar.tabs()}
      >
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

        <SidebarBody className={styles.EntrySidebar.body()}>
          <TabPanel id="history" className={styles.EntrySidebar.historyPanel()}>
            <ul className={styles.EntrySidebar.historyList()}>
              {statuses.map(status => {
                const isEditing =
                  activeStatus == status && currentlyEditing !== undefined
                const selected =
                  selectedVersion.type === 'status' &&
                  selectedVersion.status === status
                return (
                  <li key={status}>
                    <Button
                      appearance={selected ? 'active' : 'outline'}
                      intent="secondary"
                      className={styles.EntrySidebar.historyButton()}
                      onPress={() =>
                        setSelectedVersion({type: 'status', status})
                      }
                    >
                      {status}
                      {isEditing && (
                        <span className={styles.EntrySidebar.historyBadge()}>
                          Editing
                        </span>
                      )}
                    </Button>
                  </li>
                )
              })}
            </ul>
          </TabPanel>
          <TabPanel id="preview" className={styles.EntrySidebar.previewPanel()}>
            <EntrySidebarPreview entry={entry} />
          </TabPanel>
        </SidebarBody>
      </Tabs>
    </Sidebar>
  )
}
