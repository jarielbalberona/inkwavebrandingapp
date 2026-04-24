import { Link } from "@tanstack/react-router"

export function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="max-w-md space-y-4 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Not found
        </p>
        <h1 className="text-3xl font-semibold">This page does not exist.</h1>
        <p className="text-muted-foreground">
          Check the route or return to the internal app shell.
        </p>
        <Link
          to="/dashboard"
          className="bg-primary text-primary-foreground hover:bg-primary/90 p-2"
        >
          Go to dashboard
        </Link>
      </div>
    </main>
  )
}
