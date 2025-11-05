'use client'

import {Dashboard} from 'alinea/adapter/next/Dashboard'
import {cms} from '@/cms'

export default function AdminPanel() {
  return <Dashboard cms={cms} />
}
