import {notFound} from 'next/navigation'
import {cms} from '@/cms'
import {Form} from '@/Form.schema'
import {ThemedForm} from './ThemedForm'

export default async function Home({
  params
}: {
  params: Promise<{form: string}>
}) {
  const {form: path} = await params
  const page = await cms.first({type: Form, url: `/${path}`})
  if (!page) notFound()

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16 max-w-3xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-3 text-balance">
            {page?.title}
          </h1>
        </div>
        <div>
          <ThemedForm page={page} />
        </div>
      </div>
    </main>
  )
}
