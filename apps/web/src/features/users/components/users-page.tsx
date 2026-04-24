import { useMemo, useState } from "react"

import { Navigate } from "@tanstack/react-router"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
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
  useCreateUserMutation,
  useUpdateUserPermissionsMutation,
  useUsersQuery,
} from "@/features/users/hooks/use-users"
import type { PermissionDefinition, User } from "@/features/users/api/users-client"

const createUserFormSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  displayName: z.string().trim().max(160).optional(),
  password: z.string().min(12, "Password must be at least 12 characters."),
  permissions: z.array(z.string()),
})

type CreateUserFormValues = z.infer<typeof createUserFormSchema>

const defaultValues: CreateUserFormValues = {
  email: "",
  displayName: "",
  password: "",
  permissions: [],
}

export function UsersPage() {
  const currentUser = useCurrentUser()
  const canManageUsers = hasPermission(currentUser.data, appPermissions.usersManage)
  const usersQuery = useUsersQuery(canManageUsers)
  const createUser = useCreateUserMutation()
  const updatePermissions = useUpdateUserPermissionsMutation()
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [permissionUpdateError, setPermissionUpdateError] = useState<string | null>(null)
  const [permissionUpdateSuccess, setPermissionUpdateSuccess] = useState<string | null>(null)
  const form = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserFormSchema),
    defaultValues,
  })

  const users = usersQuery.data?.users ?? []
  const permissionCatalog = usersQuery.data?.permission_catalog ?? []
  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [selectedUserId, users],
  )

  if (currentUser.isLoading) {
    return <p className="text-sm text-muted-foreground">Checking access...</p>
  }

  if (!canManageUsers) {
    return <Navigate to="/dashboard" />
  }

  async function onSubmit(values: CreateUserFormValues) {
    setSubmitError(null)

    try {
      await createUser.mutateAsync({
        email: values.email,
        displayName: values.displayName?.trim() || undefined,
        password: values.password,
        role: "staff",
        permissions: values.permissions,
      })
      form.reset(defaultValues)
      setCreateDialogOpen(false)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to create staff account.")
    }
  }

  async function handlePermissionUpdate(user: User, permissions: string[]) {
    setPermissionUpdateError(null)
    setPermissionUpdateSuccess(null)

    try {
      await updatePermissions.mutateAsync({
        id: user.id,
        payload: { permissions },
      })
      setPermissionUpdateSuccess(`Updated permissions for ${user.display_name || user.email}.`)
    } catch (error) {
      setPermissionUpdateError(
        error instanceof Error ? error.message : "Unable to update assigned permissions.",
      )
    }
  }

  return (
    <div className="grid gap-4">
      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open)
          if (!open) {
            setSubmitError(null)
          }
        }}
      >
        <DialogContent className="max-h-[min(90dvh,720px)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Staff Account</DialogTitle>
            <DialogDescription>
              New staff accounts start with only the permissions you assign here.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input autoComplete="email" placeholder="staff@inkwave.local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Production Staff" {...field} />
                    </FormControl>
                    <FormDescription>Optional. Leave blank if email is enough.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Temporary Password</FormLabel>
                    <FormControl>
                      <Input autoComplete="new-password" type="password" {...field} />
                    </FormControl>
                    <FormDescription>Minimum 12 characters. Hand it to staff securely.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="permissions"
                render={({ field }) => (
                  <FormItem className="gap-3">
                    <FormLabel>Assigned Permissions</FormLabel>
                    <FormDescription>
                      These are stored on the user record. Admins already receive the full set by role.
                    </FormDescription>
                    <PermissionChecklist
                      definitions={permissionCatalog}
                      selectedPermissions={field.value}
                      onChange={field.onChange}
                    />
                  </FormItem>
                )}
              />

              {submitError ? (
                <Alert variant="destructive">
                  <AlertDescription>{submitError}</AlertDescription>
                </Alert>
              ) : null}

              <Button type="submit" disabled={createUser.isPending}>
                {createUser.isPending ? "Creating staff account..." : "Create Staff Account"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open)

          if (!open) {
            setSelectedUserId(null)
            setPermissionUpdateError(null)
            setPermissionUpdateSuccess(null)
          }
        }}
      >
        <DialogContent className="max-h-[min(90dvh,720px)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Staff Permissions</DialogTitle>
            <DialogDescription>
              Update the assigned permissions for the selected staff account. Admin permissions are
              still inherited by role and are not edited here.
            </DialogDescription>
          </DialogHeader>

          {permissionUpdateError ? (
            <Alert variant="destructive">
              <AlertDescription>{permissionUpdateError}</AlertDescription>
            </Alert>
          ) : null}

          {permissionUpdateSuccess ? (
            <Alert>
              <AlertDescription>{permissionUpdateSuccess}</AlertDescription>
            </Alert>
          ) : null}

          {selectedUser ? (
            <PermissionEditor
              key={selectedUser.id}
              user={selectedUser}
              permissionCatalog={permissionCatalog}
              onSave={handlePermissionUpdate}
              isSaving={updatePermissions.isPending}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              No staff user selected. Close this dialog and pick a staff row.
            </p>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle>User Accounts</CardTitle>
            <CardDescription>
              Permission assignments live in the backend and are enforced by the API. The web app only
              mirrors those effective permissions for visibility.
            </CardDescription>
          </div>
          <Button
            type="button"
            onClick={() => {
              setSubmitError(null)
              setCreateDialogOpen(true)
            }}
            className="shrink-0 sm:mt-0.5"
          >
            Create staff account
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4">
          {usersQuery.isError ? (
            <Alert variant="destructive">
              <AlertDescription>{usersQuery.error.message}</AlertDescription>
            </Alert>
          ) : null}

          {usersQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading user accounts...</p>
          ) : null}

          {!usersQuery.isLoading && users.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No users found. That would mean the bootstrap admin step was skipped.
            </p>
          ) : null}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Effective permissions</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow
                  key={user.id}
                  className={user.role === "staff" ? "cursor-pointer" : undefined}
                  onClick={() => {
                    if (user.role === "staff") {
                      setSelectedUserId(user.id)
                      setPermissionUpdateError(null)
                      setPermissionUpdateSuccess(null)
                      setEditDialogOpen(true)
                    }
                  }}
                >
                  <TableCell className="font-medium">{user.display_name || "No display name"}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === "admin" ? "default" : "secondary"}>{user.role}</Badge>
                  </TableCell>
                  <TableCell>{user.effective_permissions.length}</TableCell>
                  <TableCell>
                    <Badge variant={user.is_active ? "outline" : "secondary"}>
                      {user.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function PermissionEditor({
  user,
  permissionCatalog,
  onSave,
  isSaving,
}: {
  user: User
  permissionCatalog: PermissionDefinition[]
  onSave: (user: User, permissions: string[]) => Promise<void>
  isSaving: boolean
}) {
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(user.permissions)

  return (
    <div className="grid gap-4">
      <div className="grid gap-1 text-sm">
        <p className="font-medium">{user.display_name || user.email}</p>
        <p className="text-muted-foreground">{user.email}</p>
        <p className="text-muted-foreground">
          Effective permissions: {user.effective_permissions.length}
        </p>
      </div>

      <PermissionChecklist
        definitions={permissionCatalog}
        selectedPermissions={selectedPermissions}
        onChange={setSelectedPermissions}
      />

      <Button
        type="button"
        disabled={isSaving}
        onClick={() => void onSave(user, selectedPermissions)}
      >
        {isSaving ? "Saving permissions..." : "Save Permissions"}
      </Button>
    </div>
  )
}

function PermissionChecklist({
  definitions,
  selectedPermissions,
  onChange,
}: {
  definitions: PermissionDefinition[]
  selectedPermissions: string[]
  onChange: (permissions: string[]) => void
}) {
  const groupedDefinitions = useMemo(() => {
    const groups = new Map<string, PermissionDefinition[]>()

    for (const definition of definitions) {
      const existing = groups.get(definition.group) ?? []
      existing.push(definition)
      groups.set(definition.group, existing)
    }

    return [...groups.entries()]
  }, [definitions])

  return (
    <div className="grid gap-4">
      {groupedDefinitions.map(([group, groupDefinitions]) => (
        <div key={group} className="grid gap-2 border p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{group}</p>
          {groupDefinitions.map((definition) => {
            const checked = selectedPermissions.includes(definition.key)

            return (
              <div key={definition.key} className="flex items-start gap-3">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(nextChecked) => {
                    onChange(
                      nextChecked
                        ? [...selectedPermissions, definition.key]
                        : selectedPermissions.filter((permission) => permission !== definition.key),
                    )
                  }}
                />
                <div className="grid gap-1">
                  <Label>{definition.label}</Label>
                  <p className="text-sm text-muted-foreground">{definition.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
