import { useMemo, useState } from "react"

import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
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

import { useCurrentUser } from "@/features/auth/hooks/use-auth"
import { appPermissions, hasPermission } from "@/features/auth/permissions"
import {
  paperBowlColors,
  paperBowlSizes,
  type PaperBowl,
  type PaperBowlPayload,
} from "../api/paper-bowls-client"
import {
  useCreatePaperBowlMutation,
  usePaperBowlsQuery,
  useUpdatePaperBowlMutation,
} from "../hooks/use-paper-bowls"

const initialForm: PaperBowlPayload = {
  size: "220cc",
  color: "white",
  diameter_mm: null,
  min_stock: 0,
  cost_price: "0.00",
  default_sell_price: "5.00",
  is_active: true,
}

export function PaperBowlsPage() {
  const currentUser = useCurrentUser()
  const query = usePaperBowlsQuery()
  const createMutation = useCreatePaperBowlMutation()
  const updateMutation = useUpdatePaperBowlMutation()
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<PaperBowl | null>(null)
  const [form, setForm] = useState<PaperBowlPayload>(initialForm)
  const [error, setError] = useState<string | null>(null)
  const canManage = hasPermission(currentUser.data, appPermissions.cupsManage)

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return query.data ?? []
    return (query.data ?? []).filter((bowl) =>
      [bowl.name, bowl.sku, bowl.size, bowl.color].some((value) =>
        value.toLowerCase().includes(term),
      ),
    )
  }, [query.data, search])

  function openCreate() {
    setEditing(null)
    setForm(initialForm)
    setError(null)
    setDialogOpen(true)
  }

  function openEdit(bowl: PaperBowl) {
    setEditing(bowl)
    setForm({
      size: bowl.size,
      color: bowl.color,
      diameter_mm: bowl.diameter_mm,
      min_stock: bowl.min_stock,
      cost_price: bowl.cost_price ?? "0.00",
      default_sell_price: bowl.default_sell_price ?? "5.00",
      is_active: bowl.is_active,
    })
    setError(null)
    setDialogOpen(true)
  }

  async function save() {
    setError(null)
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, payload: form })
      } else {
        await createMutation.mutateAsync(form)
      }
      setDialogOpen(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save paper bowl")
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>Paper Bowls</CardTitle>
          <CardDescription>
            Standalone paper-bowl catalogue. Diameter remains optional until compatible lids are confirmed.
          </CardDescription>
        </div>
        {canManage ? <Button onClick={openCreate}>Add paper bowl</Button> : null}
      </CardHeader>
      <CardContent className="grid gap-4">
        {query.isError ? (
          <Alert variant="destructive">
            <AlertDescription>Unable to load paper bowls.</AlertDescription>
          </Alert>
        ) : null}

        <div className="max-w-sm">
          <Label htmlFor="paper-bowl-search">Search paper bowls</Label>
          <Input
            id="paper-bowl-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Size, color, or SKU"
          />
        </div>

        {query.isLoading ? <p className="text-sm text-muted-foreground">Loading paper bowls...</p> : null}

        {!query.isLoading ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Diameter</TableHead>
                <TableHead>Min stock</TableHead>
                <TableHead>Sell price</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((bowl) => (
                <TableRow
                  key={bowl.id}
                  className={canManage ? "cursor-pointer" : undefined}
                  onClick={() => canManage && openEdit(bowl)}
                >
                  <TableCell className="font-medium">{bowl.sku}</TableCell>
                  <TableCell>{bowl.name}</TableCell>
                  <TableCell>{bowl.diameter_mm ? `${bowl.diameter_mm}mm` : "Pending"}</TableCell>
                  <TableCell>{bowl.min_stock}</TableCell>
                  <TableCell>{bowl.default_sell_price ?? "Restricted"}</TableCell>
                  <TableCell>
                    <Badge variant={bowl.is_active ? "default" : "secondary"}>
                      {bowl.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit paper bowl" : "Add paper bowl"}</DialogTitle>
            <DialogDescription>
              SKU and display name are generated from size and color.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Size</Label>
              <Select
                value={form.size}
                onValueChange={(size: PaperBowlPayload["size"]) => setForm({ ...form, size })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {paperBowlSizes.map((size) => <SelectItem key={size} value={size}>{size}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Color</Label>
              <Select
                value={form.color}
                onValueChange={(color: PaperBowlPayload["color"]) => setForm({ ...form, color })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {paperBowlColors.map((color) => <SelectItem key={color} value={color}>{color[0].toUpperCase() + color.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bowl-diameter">Diameter (mm, optional)</Label>
              <Input
                id="bowl-diameter"
                type="number"
                min={1}
                value={form.diameter_mm ?? ""}
                onChange={(event) => setForm({ ...form, diameter_mm: event.target.value ? Number(event.target.value) : null })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bowl-min-stock">Minimum stock</Label>
              <Input
                id="bowl-min-stock"
                type="number"
                min={0}
                value={form.min_stock}
                onChange={(event) => setForm({ ...form, min_stock: Number(event.target.value) })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bowl-cost">Cost price</Label>
              <Input
                id="bowl-cost"
                type="number"
                min={0}
                step="0.01"
                value={form.cost_price}
                onChange={(event) => setForm({ ...form, cost_price: event.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bowl-sell">Default sell price</Label>
              <Input
                id="bowl-sell"
                type="number"
                min={0}
                step="0.01"
                value={form.default_sell_price}
                onChange={(event) => setForm({ ...form, default_sell_price: event.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <Checkbox
                checked={form.is_active}
                onCheckedChange={(checked) => setForm({ ...form, is_active: checked === true })}
              />
              Active
            </label>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={isSaving}>{isSaving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
