import { useMemo, useState } from "react"

import { Link } from "@tanstack/react-router"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import {
  inventoryMovementTypeOptions,
  useInventoryMovementsQuery,
} from "@/features/inventory/hooks/use-inventory"

export function InventoryHistoryPage() {
  const [itemId, setItemId] = useState("")
  const [itemType, setItemType] = useState<string>("all")
  const [movementType, setMovementType] = useState<string>("all")
  const query = useMemo(
    () => ({
      itemType: itemType === "all" ? undefined : (itemType as "cup" | "lid"),
      itemId: itemId.trim() || undefined,
      movementType: movementType === "all" ? undefined : movementType,
    }),
    [itemId, itemType, movementType],
  )
  const movementsQuery = useInventoryMovementsQuery(query)

  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid gap-1">
            <CardTitle>Inventory Movement History</CardTitle>
            <CardDescription>
              Inspect the ledger when balances look wrong. Filters support tracked item type, item ID, and movement type.
            </CardDescription>
          </div>
          <Button asChild type="button" variant="outline">
            <Link to="/inventory">Back to inventory</Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_12rem_16rem]">
          <div className="grid gap-2">
            <Label htmlFor="movement-item-id">Tracked item ID</Label>
            <Input
              id="movement-item-id"
              placeholder="Filter by tracked item UUID"
              value={itemId}
              onChange={(event) => setItemId(event.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label>Item type</Label>
            <Select value={itemType} onValueChange={setItemType}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All item types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All item types</SelectItem>
                <SelectItem value="cup">Cup</SelectItem>
                <SelectItem value="lid">Lid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Movement type</Label>
            <Select value={movementType} onValueChange={setMovementType}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All movement types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All movement types</SelectItem>
                {inventoryMovementTypeOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid gap-4">
        {movementsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading movement history...</p>
        ) : null}

        {movementsQuery.isError ? (
          <p className="text-sm text-destructive">{movementsQuery.error.message}</p>
        ) : null}

        {!movementsQuery.isLoading &&
        !movementsQuery.isError &&
        (movementsQuery.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">No inventory movements match the current filters.</p>
        ) : null}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Item type</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Note</TableHead>
              <TableHead>Created by</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movementsQuery.data?.map((movement) => (
              <TableRow key={movement.id}>
                <TableCell className="whitespace-nowrap text-sm">
                  {new Date(movement.created_at).toLocaleString()}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{movement.item_type}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={movementVariant(movement.movement_type)}>
                    {movement.movement_type}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="grid gap-0.5">
                    <span className="font-medium">
                      {movement.item_type === "cup"
                        ? movement.cup.sku
                        : movement.lid.sku}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {movement.item_type === "cup"
                        ? `${movement.cup.brand} · ${movement.cup.size}`
                        : `${movement.lid.type} · ${movement.lid.brand} · ${movement.lid.color}`}
                    </span>
                  </div>
                </TableCell>
                <TableCell>{movement.quantity}</TableCell>
                <TableCell>{movement.reference ?? "—"}</TableCell>
                <TableCell>{movement.note ?? "—"}</TableCell>
                <TableCell>
                  {movement.created_by
                    ? movement.created_by.display_name ?? movement.created_by.email
                    : "System"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function movementVariant(
  type: string,
): "default" | "secondary" | "destructive" {
  if (type === "adjustment_out" || type === "consume") {
    return "destructive"
  }

  if (type === "reserve" || type === "release_reservation") {
    return "secondary"
  }

  return "default"
}
