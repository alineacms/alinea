import dynamic from 'next/dynamic'

export const Dashboard = dynamic(
  () => import('alinea/dashboard/Dashboard').then(m => m.Dashboard),
  {
    ssr: false
  }
)
