import { Navigate, createFileRoute } from "@tanstack/react-router"

import { useCurrentUser } from "@/features/auth/hooks/use-auth"

export const Route = createFileRoute("/")({
  component: IndexPage,
})

function IndexPage() {
  const currentUser = useCurrentUser()

  if (currentUser.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 text-sm text-muted-foreground">
        Checking session...
      </main>
    )
  }

  if (!currentUser.data) {
    return <Navigate to="/login" />
  }

  return <Navigate to="/dashboard" />
}
