import { PlaceholderPage } from "@/components/placeholder-page"

export function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-xl">
        <PlaceholderPage
          eyebrow="Public route"
          title="Sign in"
          description="Auth is intentionally deferred. This page reserves the public login entry point for the future app-managed session flow."
          cta={{
            label: "View app shell",
            to: "/dashboard",
          }}
        />
      </div>
    </main>
  )
}
