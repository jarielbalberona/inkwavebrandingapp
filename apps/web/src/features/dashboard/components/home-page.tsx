import { Link } from "@tanstack/react-router"

export function HomePage() {
  return (
    <main className="min-h-screen bg-background px-4 py-12 text-foreground sm:px-6 lg:px-8">
      <section className="mx-auto max-w-4xl space-y-6">
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">
            Ink Wave Branding App
          </p>
          <h1 className="text-4xl font-semibold tracking-tight">
            Routing scaffold for cup printing operations.
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            This route confirms the frontend shell is wired. Business workflows
            are intentionally deferred until their implementation tickets.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/dashboard"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Open dashboard
          </Link>
          <Link
            to="/login"
            className="rounded-md border px-4 py-2 text-sm font-medium"
          >
            View login route
          </Link>
        </div>
      </section>
    </main>
  )
}
