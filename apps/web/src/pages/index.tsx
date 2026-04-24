import { Navigate, createFileRoute } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"

import { useCurrentUser, useLogoutMutation } from "@/features/auth/hooks/use-auth"
import { getDefaultAuthorizedRoute } from "@/features/auth/permissions"

export const Route = createFileRoute("/")({
  component: IndexPage,
})

function IndexPage() {
  const currentUser = useCurrentUser()
  const logoutMutation = useLogoutMutation()

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

  const defaultRoute = getDefaultAuthorizedRoute(currentUser.data)

  if (!defaultRoute) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="grid max-w-md gap-4 text-center">
          <p className="text-sm text-muted-foreground">
            This account is signed in, but no view permissions are assigned yet.
          </p>
          <div className="flex justify-center">
            <Button
              type="button"
              variant="outline"
              disabled={logoutMutation.isPending}
              onClick={() => {
                void logoutMutation.mutateAsync()
              }}
            >
              {logoutMutation.isPending ? "Signing out..." : "Log Out"}
            </Button>
          </div>
        </div>
      </main>
    )
  }

  return <Navigate to={defaultRoute} />
}
