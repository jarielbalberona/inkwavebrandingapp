import {
  ArrowRightIcon,
  BookOpenTextIcon,
  BoxIcon,
  PackageSearchIcon,
  ShoppingCartIcon,
} from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

const cards = [
  {
    title: "Cups Catalog",
    description: "SKU-driven cup records and status management",
    status: "Planned",
    detail: "Catalog CRUD will land after auth and persistence are in place.",
    icon: BoxIcon,
  },
  {
    title: "Inventory Ledger",
    description: "Stock intake, balances, reservations, and adjustments",
    status: "Planned",
    detail: "Ledger rules are deferred until backend inventory foundations exist.",
    icon: PackageSearchIcon,
  },
  {
    title: "Orders",
    description: "Reservation-first order lifecycle and consumption flow",
    status: "Planned",
    detail: "Order movements are intentionally blocked on inventory correctness.",
    icon: ShoppingCartIcon,
  },
  {
    title: "Reports",
    description: "Operational reporting on top of real source data",
    status: "Blocked",
    detail: "Reporting waits on trustworthy cups, inventory, and orders data.",
    icon: BookOpenTextIcon,
  },
] as const

export function SectionCards() {
  return (
    <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon

        return (
          <Card key={card.title} className="@container/card">
            <CardHeader>
              <CardDescription className="flex items-center gap-2">
                <Icon className="size-4" />
                {card.description}
              </CardDescription>
              <CardTitle className="text-2xl font-semibold normal-case tracking-normal">
                {card.title}
              </CardTitle>
              <CardAction>
                <Badge variant="outline">{card.status}</Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <div className="flex items-center gap-2 font-medium">
                Routing scaffold only
                <ArrowRightIcon className="size-4" />
              </div>
              <div className="text-muted-foreground">{card.detail}</div>
            </CardFooter>
          </Card>
        )
      })}
    </div>
  )
}
