import dynamic from 'next/dynamic'
import 'alinea/css'

export const Dashboard = dynamic(
  () => import('alinea/dashboard/Dashboard').then(m => m.Dashboard),
  {
    ssr: false
  }
)
