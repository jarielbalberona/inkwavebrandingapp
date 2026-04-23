import { PlaceholderPage } from "@/components/placeholder-page"

export function HomePage() {
  return (
    <main className="min-h-screen px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <PlaceholderPage
          eyebrow="Ink Wave Branding App"
          title="Routing scaffold for cup printing operations."
          description="This route confirms the frontend shell is wired. Business workflows are intentionally deferred until their implementation tickets."
          cta={{
            label: "Open dashboard",
            to: "/dashboard",
          }}
        />
      </div>
    </main>
  )
}
