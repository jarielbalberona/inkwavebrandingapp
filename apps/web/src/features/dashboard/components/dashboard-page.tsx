import { PlaceholderPage } from "@/components/placeholder-page"
import { SectionCards } from "@/components/section-cards"

export function DashboardPage() {
  return (
    <div className="space-y-6">
      <PlaceholderPage
        eyebrow="Internal operations"
        title="Dashboard"
        description="This is the shell foundation only. Real summaries and KPIs will come after auth, cups, inventory, and orders are implemented."
      />
      <SectionCards />
    </div>
  )
}
