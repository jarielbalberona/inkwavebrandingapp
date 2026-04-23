import { Link } from "@tanstack/react-router"

export function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <section className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Public route</p>
          <h1 className="text-2xl font-semibold">Sign in</h1>
          <p className="text-sm text-muted-foreground">
            Auth is intentionally deferred. This page reserves the public login
            entry point for the future app-managed session flow.
          </p>
        </div>
        <div className="mt-6">
          <Link
            to="/dashboard"
            className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            View app shell
          </Link>
        </div>
      </section>
    </main>
  )
}
