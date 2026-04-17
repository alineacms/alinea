import {Stack} from '../stories/Stack.tsx'
import {Tab, TabList, TabPanel, Tabs} from './Tabs.tsx'

export const Variants = () => (
  <Stack gap={32}>
    <Tabs>
      <TabList>
        <Tab id="tab1">Tab 1</Tab>
        <Tab id="tab2">Tab 2</Tab>
        <Tab id="tab3">Tab 3</Tab>
      </TabList>
      <TabPanel id="tab1">
        Lorem ipsum dolor sit amet, consectetur adipiscing elit.
      </TabPanel>
      <TabPanel id="tab2">
        Aliquam ipsum nisl, venenatis vitae volutpat in, sagittis lorem.
      </TabPanel>
      <TabPanel id="tab3">
        Proin rhoncus, nunc eu venenatis convallis, arcu sagittis risus.
      </TabPanel>
    </Tabs>
    <Tabs variant="subtle">
      <TabList>
        <Tab id="tab1">Details</Tab>
        <Tab id="tab2">Address</Tab>
        <Tab id="tab3">Contacts</Tab>
        <Tab id="tab4">Projects</Tab>
        <Tab id="tab5">Subscriptions</Tab>
        <Tab id="tab6">Estimates</Tab>
        <Tab id="tab7">Invoices</Tab>
      </TabList>
      <TabPanel id="tab1">
        Here you can find detailed information about the selected item.
      </TabPanel>
      <TabPanel id="tab2">This section contains the address details.</TabPanel>
      <TabPanel id="tab3">Contact information is listed here.</TabPanel>
      <TabPanel id="tab4">View and manage your projects in this tab.</TabPanel>
      <TabPanel id="tab5">
        Information about your subscriptions can be found here.
      </TabPanel>
      <TabPanel id="tab6">
        This tab contains estimates and related details.
      </TabPanel>
      <TabPanel id="tab7">Here you can view and manage your invoices.</TabPanel>
    </Tabs>
    <Tabs variant="enclosed">
      <TabList>
        <Tab id="tab1">Tab 1</Tab>
        <Tab id="tab2">Tab 2</Tab>
        <Tab id="tab3">Tab 3</Tab>
      </TabList>
      <TabPanel id="tab1">
        Lorem ipsum dolor sit amet, consectetur adipiscing elit.
      </TabPanel>
      <TabPanel id="tab2">
        Aliquam ipsum nisl, venenatis vitae volutpat in, sagittis lorem.
      </TabPanel>
      <TabPanel id="tab3">
        Proin rhoncus, nunc eu venenatis convallis, arcu sagittis risus.
      </TabPanel>
    </Tabs>
  </Stack>
)

export const Orientation = () => (
  <Tabs orientation="vertical" variant="subtle" overflow>
    <TabList overflow>
      <Tab id="tab1">Tab 1</Tab>
      <Tab id="tab2">Tab 2</Tab>
      <Tab id="tab3">Tab 3</Tab>
    </TabList>
    <TabPanel id="tab1">
      Lorem ipsum dolor sit amet, consectetur adipiscing elit.
    </TabPanel>
    <TabPanel id="tab2">
      Aliquam ipsum nisl, venenatis vitae volutpat in, sagittis lorem.
    </TabPanel>
    <TabPanel id="tab3">
      Proin rhoncus, nunc eu venenatis convallis, arcu sagittis risus.
    </TabPanel>
  </Tabs>
)

export const overflow = () => (
  <Tabs variant="subtle">
    <TabList>
      <Tab id="tab1">Details</Tab>
      <Tab id="tab2">Address</Tab>
      <Tab id="tab3">Contacts</Tab>
      <Tab id="tab4">Projects</Tab>
      <Tab id="tab5">Subscriptions</Tab>
      <Tab id="tab6">Estimates</Tab>
      <Tab id="tab7">Invoices</Tab>
      <Tab id="tab8">Payments</Tab>
      <Tab id="tab9">Reports</Tab>
      <Tab id="tab10">Settings</Tab>
      <Tab id="tab11">Notifications</Tab>
      <Tab id="tab12">Activity</Tab>
      <Tab id="tab13">Support</Tab>
      <Tab id="tab14">Feedback</Tab>
      <Tab id="tab15">Profile</Tab>
      <Tab id="tab16">Security</Tab>
      <Tab id="tab17">Billing</Tab>
      <Tab id="tab18">Integrations</Tab>
      <Tab id="tab19">API</Tab>
      <Tab id="tab20">Logs</Tab>
    </TabList>
    <TabPanel id="tab1">
      Here you can find detailed information about the selected item.
    </TabPanel>
    <TabPanel id="tab2">This section contains the address details.</TabPanel>
    <TabPanel id="tab3">Contact information is listed here.</TabPanel>
    <TabPanel id="tab4">View and manage your projects in this tab.</TabPanel>
    <TabPanel id="tab5">
      Information about your subscriptions can be found here.
    </TabPanel>
    <TabPanel id="tab6">
      This tab contains estimates and related details.
    </TabPanel>
    <TabPanel id="tab7">Here you can view and manage your invoices.</TabPanel>
    <TabPanel id="tab8">Manage your payments in this section.</TabPanel>
    <TabPanel id="tab9">Access various reports here.</TabPanel>
    <TabPanel id="tab10">Customize your settings in this tab.</TabPanel>
    <TabPanel id="tab11">View your notifications here.</TabPanel>
    <TabPanel id="tab12">Track your activity in this section.</TabPanel>
    <TabPanel id="tab13">Get support and help here.</TabPanel>
    <TabPanel id="tab14">Provide feedback in this tab.</TabPanel>
    <TabPanel id="tab15">Manage your profile information here.</TabPanel>
    <TabPanel id="tab16">
      Update your security settings in this section.
    </TabPanel>
    <TabPanel id="tab17">
      View and manage your billing information here.
    </TabPanel>
    <TabPanel id="tab18">Configure integrations in this tab.</TabPanel>
    <TabPanel id="tab19">Access API settings and documentation here.</TabPanel>
    <TabPanel id="tab20">View system logs in this section.</TabPanel>
  </Tabs>
)

export default {
  title: 'Components / Tabs'
}
