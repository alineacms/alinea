import {Icon, Tab, TabList, TabPanel, Tabs} from '@alinea/components'
import {styler} from '@alinea/styler'
import {IcRoundHistory, IcRoundVisibility} from '../icons.js'
import css from './EntrySidebar.module.css'
import {Sidebar, SidebarBody, SidebarHeader} from './ui/Sidebar.js'

const styles = styler(css)

export function EntrySidebar() {
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
          <TabPanel id="history">History placeholder</TabPanel>
          <TabPanel id="preview">Preview placeholder</TabPanel>
        </SidebarBody>
      </Tabs>
    </Sidebar>
  )
}
