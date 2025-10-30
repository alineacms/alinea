import Link from 'next/link.js'
import {cms} from '@/cms'
import {Form} from '@/Form.schema'

export default async function Home() {
  const forms = await cms.find({type: Form})

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16 max-w-3xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-3 text-balance">
            Form Builder Demo
          </h1>
          <p className="text-muted-foreground text-lg">
            Explore different form implementations and capabilities
          </p>
        </div>

        <div className="space-y-4">
          {forms.map(form => {
            return (
              <Link key={form._id} href={form._url}>
                {form.title}
              </Link>
            )
          })}
        </div>
      </div>
    </main>
  )
}
