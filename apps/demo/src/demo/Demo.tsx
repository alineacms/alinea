'use client'

import {createMemoryHandler} from 'alinea/backend/data/MemoryHandler'
//import {createTestCMS} from 'alinea/core/driver/TestDriver'
import {createCMS} from 'alinea/core/driver/DefaultDriver.server'
import {Logger} from 'alinea/core/util/Logger'
import 'alinea/css'
import {App} from 'alinea/dashboard/App'
import {Modal} from 'alinea/dashboard/view/Modal'
import {Viewport} from 'alinea/dashboard/view/Viewport'
import {Button, HStack, Loader, Typo} from 'alinea/ui'
import {Suspense, use, useMemo, useState} from 'react'
import {config} from '../../alinea.config'

const cms = createCMS(config)

export default function Demo() {
  const [reminderOpen, setReminderOpen] = useState(true)
  const db = use(cms.db)
  const handler = useMemo(() => createMemoryHandler(cms, db), [db])
  const client = useMemo(
    () =>
      handler.connect({
        logger: new Logger('local')
      }),
    [handler]
  )
  return (
    <>
      <style>{`#__next {height: 100%}`}</style>
      <Viewport attachToBody color="#5661E5" contain>
        <Modal open={reminderOpen} onClose={() => setReminderOpen(false)}>
          <Typo.H1>Demo</Typo.H1>
          <Typo.P>
            This is a demo showcasing the{' '}
            <Typo.Link href="https://alinea.sh">Alinea CMS</Typo.Link>{' '}
            dashboard. It is not connected to a server, any changes you make are
            persisted locally.
          </Typo.P>
          <HStack>
            <Button size="large" onClick={() => setReminderOpen(false)}>
              Let&apos;s see it
            </Button>
          </HStack>
        </Modal>
        <Suspense fallback={<Loader absolute />}>
          <App dev config={cms.config} client={client} />
        </Suspense>
      </Viewport>
    </>
  )
}
