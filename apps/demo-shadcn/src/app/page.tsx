import Link from 'next/link'
import {cms} from '@/cms'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
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
                <Card className="hover:border-foreground/20 hover:bg-accent/50 transition-all duration-200 group">
                  <CardHeader>
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-md bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors text-xl">
                        📝
                      </div>
                      <div className="flex-1">
                        <CardTitle className="group-hover:text-foreground transition-colors">
                          {form.title}
                        </CardTitle>
                        <CardDescription>{form.description}</CardDescription>
                      </div>
                      <svg
                        className="w-5 h-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>
    </main>
  )
}
