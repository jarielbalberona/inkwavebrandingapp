import { Link } from "@tanstack/react-router"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

type PlaceholderPageProps = {
  eyebrow: string
  title: string
  description: string
  cta?: {
    label: string
    to: "/" | "/login" | "/dashboard"
    variant?: "default" | "outline"
  }
}

export function PlaceholderPage({
  eyebrow,
  title,
  description,
  cta,
}: PlaceholderPageProps) {
  return (
    <section className="max-w-4xl space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">{eyebrow}</p>
        <h1 className="text-3xl font-semibold">{title}</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent />
        {cta ? (
          <CardFooter className="border-t">
            <Button asChild variant={cta.variant ?? "default"}>
              <Link to={cta.to}>{cta.label}</Link>
            </Button>
          </CardFooter>
        ) : null}
      </Card>
    </section>
  )
}
