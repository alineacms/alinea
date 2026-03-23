import {Icon, Tab, TabList, TabPanel, Tabs} from '@alinea/components'
import {styler} from '@alinea/styler'
import {IcRoundHistory, IcRoundVisibility} from '../icons.js'
import css from './EntrySidebar.module.css'
import {Sidebar, SidebarBody, SidebarHeader} from './ui/Sidebar.js'

const styles = styler(css)

export function EntrySidebar() {
  return (
    <Sidebar className={styles.entrySidebar()} divider="left" layout>
      <Tabs defaultSelectedKey="history" variant="subtle">
        <SidebarHeader>
          <div className={styles.entrySidebarTabsWrap()}>
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
          </div>
        </SidebarHeader>

        <SidebarBody scroll>
          <TabPanel className={styles.sidebarPanel()} id="history">
            History placeholder
          </TabPanel>
          <TabPanel className={styles.sidebarPanel()} id="preview">
            Preview placeholder
          </TabPanel>
        </SidebarBody>
      </Tabs>
    </Sidebar>
  )
}
