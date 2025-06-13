'use client'
import {cms} from '@/cms'
import {Dashboard} from 'alinea/adapter/next/Dashboard'

export default function AdminPanel() {
  return <Dashboard cms={cms} handler="/api/cms" />
}
