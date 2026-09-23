import {useState} from 'react'
import {Tabs, TabsContent, TabsList, TabsTrigger} from './Tabs.js'

const sections = [
  {value: 'account', label: 'Account', text: 'Make changes to your account.'},
  {value: 'password', label: 'Password', text: 'Change your password here.'},
  {value: 'billing', label: 'Billing', text: 'Manage your subscription.'}
]

export function Example() {
  return (
    <Tabs defaultValue="account">
      <TabsList aria-label="Settings">
        {sections.map(section => (
          <TabsTrigger key={section.value} value={section.value}>
            {section.label}
          </TabsTrigger>
        ))}
        <TabsTrigger value="disabled" disabled>
          Disabled
        </TabsTrigger>
      </TabsList>
      {sections.map(section => (
        <TabsContent key={section.value} value={section.value}>
          {section.text}
        </TabsContent>
      ))}
    </Tabs>
  )
}

export function Variants() {
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 32}}>
      {(['line', 'subtle', 'enclosed'] as const).map(variant => (
        <Tabs key={variant} variant={variant} defaultValue="account">
          <TabsList aria-label={`${variant} tabs`}>
            {sections.map(section => (
              <TabsTrigger key={section.value} value={section.value}>
                {section.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {sections.map(section => (
            <TabsContent key={section.value} value={section.value}>
              {section.text}
            </TabsContent>
          ))}
        </Tabs>
      ))}
    </div>
  )
}

export function Controlled() {
  const [value, setValue] = useState('password')
  return (
    <div>
      <p>Selected: {value}</p>
      <Tabs value={value} onValueChange={setValue}>
        <TabsList aria-label="Settings">
          {sections.map(section => (
            <TabsTrigger key={section.value} value={section.value}>
              {section.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {sections.map(section => (
          <TabsContent key={section.value} value={section.value}>
            {section.text}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

export function Vertical() {
  return (
    <Tabs orientation="vertical" variant="subtle" defaultValue="account">
      <TabsList aria-label="Settings">
        {sections.map(section => (
          <TabsTrigger key={section.value} value={section.value}>
            {section.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {sections.map(section => (
        <TabsContent key={section.value} value={section.value}>
          {section.text}
        </TabsContent>
      ))}
    </Tabs>
  )
}

const many = Array.from({length: 20}, (_, index) => `Tab ${index + 1}`)

export function Overflow() {
  return (
    <div style={{width: 400}}>
      <Tabs defaultValue="Tab 1">
        <TabsList aria-label="Many tabs">
          {many.map(tab => (
            <TabsTrigger key={tab} value={tab}>
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>
        {many.map(tab => (
          <TabsContent key={tab} value={tab}>
            Content of {tab}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

export default {
  title: 'Pure components / Tabs'
}
