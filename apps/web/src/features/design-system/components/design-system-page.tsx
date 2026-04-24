import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
} from "recharts";
import { z } from "zod";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarDays,
  CloudUpload,
  Globe,
  Info,
  Loader2,
  MoreHorizontal,
  Palette,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog";
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";
import { Badge } from "@workspace/ui/components/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup } from "@workspace/ui/components/button-group";
import { Calendar } from "@workspace/ui/components/calendar";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import type { ChartConfig } from "@workspace/ui/components/chart";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@workspace/ui/components/chart";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { DatePicker } from "@workspace/ui/components/date-picker";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@workspace/ui/components/form";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@workspace/ui/components/hover-card";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { Progress } from "@workspace/ui/components/progress";
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Separator } from "@workspace/ui/components/separator";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Switch } from "@workspace/ui/components/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { Textarea } from "@workspace/ui/components/textarea";
import { Toggle } from "@workspace/ui/components/toggle";
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import { displayAmount } from "@workspace/ui/lib/number";
import { getTailwindDefaultSwatch } from "@workspace/ui/lib/tailwind-swatch-color";
import { cn } from "@workspace/ui/lib/utils";

const trafficData = [
  { month: "Jan", desktop: 180, mobile: 64 },
  { month: "Feb", desktop: 132, mobile: 88 },
  { month: "Mar", desktop: 204, mobile: 104 },
  { month: "Apr", desktop: 148, mobile: 72 },
  { month: "May", desktop: 170, mobile: 96 },
  { month: "Jun", desktop: 196, mobile: 118 },
];

const visitorData = [
  { month: "Jan", visitors: 180 },
  { month: "Feb", visitors: 260 },
  { month: "Mar", visitors: 300 },
  { month: "Apr", visitors: 142 },
  { month: "May", visitors: 268 },
  { month: "Jun", visitors: 238 },
];

const browserShare = [
  { name: "Chrome", value: 48, fill: "var(--chart-1)" },
  { name: "Edge", value: 21, fill: "var(--chart-2)" },
  { name: "Firefox", value: 19, fill: "var(--chart-3)" },
  { name: "Safari", value: 12, fill: "var(--chart-4)" },
];

const trafficConfig = {
  desktop: { label: "Desktop", color: "var(--chart-1)" },
  mobile: { label: "Mobile", color: "var(--chart-2)" },
} satisfies ChartConfig;

const visitorsConfig = {
  visitors: { label: "Visitors", color: "var(--chart-3)" },
} satisfies ChartConfig;

const browserConfig = {
  chrome: { label: "Chrome", color: "var(--chart-1)" },
  edge: { label: "Edge", color: "var(--chart-2)" },
  firefox: { label: "Firefox", color: "var(--chart-3)" },
  safari: { label: "Safari", color: "var(--chart-4)" },
} satisfies ChartConfig;

const fitnessDays = [
  { label: "M", value: 74 },
  { label: "T", value: 42 },
  { label: "W", value: 66 },
  { label: "T", value: 58 },
  { label: "F", value: 78 },
  { label: "S", value: 40 },
  { label: "S", value: 56 },
];

const sleepBlocks = [
  { label: "Deep", value: 36 },
  { label: "Light", value: 64 },
  { label: "REM", value: 52 },
  { label: "Awake", value: 20 },
];

const invoiceRows = [
  { item: "Design system license", qty: "1", rate: "₱24,990.00", amount: "₱24,990.00" },
  { item: "Priority support", qty: "12", rate: "₱4,950.00", amount: "₱59,400.00" },
  { item: "Custom components", qty: "3", rate: "₱12,500.00", amount: "₱37,500.00" },
];

const shortcutRows = [
  { label: "Quick actions", key: "J" },
  { label: "New file", key: "N" },
  { label: "Save draft", key: "S" },
  { label: "Toggle sidebar", key: "B" },
];

const buttonVariantRows = [
  ["default", "Default"],
  ["outline", "Outline"],
  ["secondary", "Secondary"],
  ["ghost", "Ghost"],
  ["destructive", "Destructive"],
  ["link", "Link"],
] as const;

const buttonSizeRows = [
  ["xs", "XS"],
  ["sm", "SM"],
  ["default", "Default"],
  ["lg", "LG"],
] as const;

const badgeVariantRows = [
  ["default", "Default"],
  ["secondary", "Secondary"],
  ["outline", "Outline"],
  ["ghost", "Ghost"],
  ["destructive", "Destructive"],
  ["link", "Link"],
] as const;

const densityRows = [
  ["compact", "Compact"],
  ["comfortable", "Comfortable"],
  ["spacious", "Spacious"],
] as const;

const paletteSwatches = [
  "bg-background",
  "bg-foreground",
  "bg-primary",
  "bg-secondary",
  "bg-muted",
  "bg-accent",
  "bg-destructive",
  "bg-card",
  "bg-popover",
] as const;

/** Steps aligned with Tailwind’s default palette (see https://tailwindcss.com/docs/colors). */
const tailwindScaleSteps = [
  "50",
  "100",
  "200",
  "300",
  "400",
  "500",
  "600",
  "700",
  "800",
  "900",
  "950",
] as const;

const tailwindHueScales = [
  ["orange", "Orange"],
  ["sky", "Sky"],
  ["emerald", "Emerald"],
  ["violet", "Violet"],
  ["rose", "Rose"],
  ["slate", "Slate"],
] as const;

const brandPaletteSteps = [
  "50",
  "100",
  "200",
  "300",
  "400",
  "500",
  "600",
  "700",
  "800",
  "900",
] as const;

const brandPalettes = [
  ["tealdeep", "Teal deep"],
  ["aqualight", "Aqua light"],
  ["bluemuted", "Blue muted"],
  ["coral", "Coral"],
  ["greenmuted", "Green muted"],
] as const;

const semanticThemeSwatches: { label: string; className: string }[] = [
  { label: "background", className: "bg-background" },
  { label: "foreground", className: "bg-foreground" },
  { label: "primary", className: "bg-primary" },
  { label: "primary-foreground", className: "bg-primary-foreground" },
  { label: "secondary", className: "bg-secondary" },
  { label: "muted", className: "bg-muted" },
  { label: "accent", className: "bg-accent" },
  { label: "destructive", className: "bg-destructive" },
  { label: "border", className: "bg-border" },
  { label: "input", className: "bg-input" },
  { label: "ring", className: "bg-ring" },
];

const chartSwatches = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"] as const;

function DemoTile({
  title,
  description,
  action,
  children,
  footer,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("break-inside-avoid", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
      {footer ? <CardFooter>{footer}</CardFooter> : null}
    </Card>
  );
}

function StatChip({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "positive";
}) {
  return (
    <div
      className={cn(
        "xl border px-3 py-2",
        tone === "positive" ? "border-primary/20 bg-primary/5" : "bg-muted/40"
      )}
    >
      <p className="text-muted-foreground text-xs tracking-[0.18em] uppercase">{label}</p>
      <p className="mt-1 font-semibold text-base">{value}</p>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
      {children}
    </p>
  );
}

function ColorHueScaleRow({
  name,
  label,
  shades,
  columnsClass,
}: {
  name: string;
  label: string;
  shades: readonly string[];
  columnsClass: string;
}) {
  return (
    <div className="space-y-2">
      <p className="font-medium text-sm">{label}</p>
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className={cn("grid gap-1", columnsClass)}>
          {shades.map((step) => (
            <div key={step} className="flex min-w-0 flex-col items-center gap-1">
              <div
                className="aspect-square w-full max-h-11 md border border-black/10 sm:max-h-12 dark:border-white/15"
                style={{
                  backgroundColor:
                    getTailwindDefaultSwatch(name, step) ??
                    `var(--color-${name}-${step})`,
                }}
                title={
                  getTailwindDefaultSwatch(name, step)
                    ? `${name}-${step}`
                    : `var(--color-${name}-${step})`
                }
              />
              <span className="text-muted-foreground text-[9px] tabular-nums sm:text-[10px]">
                {step}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KbdInline({ children }: { children: ReactNode }) {
  return (
    <kbd className="pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1 sm bg-muted px-1 font-sans text-muted-foreground text-xs font-medium select-none">
      {children}
    </kbd>
  );
}

function DatePickerSample() {
  const [singleDate, setSingleDate] = useState<Date | undefined>(undefined);
  const [rangeStart, setRangeStart] = useState<Date | undefined>(undefined);
  const [rangeEnd, setRangeEnd] = useState<Date | undefined>(undefined);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const maxDate = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 15);
    return d;
  }, [today]);

  const inWindow = (d: Date) => d >= today && d <= maxDate;

  return (
    <div className="space-y-6">
      <div className="grid gap-6">
        <div className="space-y-2">
          <h4 className="font-medium">Single date</h4>
          <DatePicker placeholder="Pick a date" value={singleDate} onSelect={setSingleDate} />
          <p className="text-gray-500 text-xs">Value: {singleDate?.toLocaleDateString() ?? "—"}</p>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium">Range (calendars with min / max window)</h4>
          <p className="text-gray-500 text-xs">
            Window: {today.toLocaleDateString()} — {maxDate.toLocaleDateString()}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Start</Label>
              <div className="overflow-hidden xl border">
                <Calendar
                  mode="single"
                  selected={rangeStart}
                  onSelect={(d) => {
                    setRangeStart(d);
                    if (d && rangeEnd && rangeEnd < d) setRangeEnd(undefined);
                  }}
                  disabled={(date) => !inWindow(date)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>End</Label>
              <div className="overflow-hidden xl border">
                <Calendar
                  mode="single"
                  selected={rangeEnd}
                  onSelect={setRangeEnd}
                  disabled={(date) => !inWindow(date) || (rangeStart ? date < rangeStart : false)}
                />
              </div>
            </div>
          </div>
          <p className="text-gray-500 text-xs">
            Range: {rangeStart?.toLocaleDateString() ?? "—"} —{" "}
            {rangeEnd?.toLocaleDateString() ?? "—"}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Date range in a form (zod)</h4>
        <DateRangeForm today={today} maxDate={maxDate} />
      </div>
    </div>
  );
}

function DateRangeForm({ today, maxDate }: { today: Date; maxDate: Date }) {
  const schema = useMemo(
    () =>
      z
        .object({
          start: z.date(),
          end: z.date(),
        })
        .refine((d) => d.end >= d.start, {
          path: ["end"],
          message: "End must be on or after start",
        })
        .refine((d) => d.start >= today && d.start <= maxDate, {
          path: ["start"],
          message: "Start must be within window",
        })
        .refine((d) => d.end >= today && d.end <= maxDate, {
          path: ["end"],
          message: "End must be within window",
        }),
    [today, maxDate]
  );

  type RangeValues = z.infer<typeof schema>;

  const form = useForm<RangeValues>({
    resolver: zodResolver(schema),
    defaultValues: { start: today, end: today },
    mode: "onChange",
  });

  const start = form.watch("start");
  const end = form.watch("end");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(() => null)} className="space-y-3">
        <div className="grid gap-3">
          <FormField
            control={form.control}
            name="start"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start</FormLabel>
                <FormControl>
                  <div className="overflow-hidden xl border">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={(d) => field.onChange(d)}
                      disabled={(date) =>
                        date < today || date > maxDate || (end ? date > end : false)
                      }
                    />
                  </div>
                </FormControl>
                
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="end"
            render={({ field }) => (
              <FormItem>
                <FormLabel>End</FormLabel>
                <FormControl>
                  <div className="overflow-hidden xl border">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={(d) => field.onChange(d)}
                      disabled={(date) =>
                        date < today || date > maxDate || (start ? date < start : false)
                      }
                    />
                  </div>
                </FormControl>
                
              </FormItem>
            )}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button type="submit">Submit</Button>
          <span className="text-gray-500 text-xs">
            Window: {today.toLocaleDateString()} — {maxDate.toLocaleDateString()}
          </span>
        </div>
      </form>
    </Form>
  );
}

function InputSample() {
  return (
    <div className="space-y-6">
      <div>
        <h4 className="mb-4 font-medium">Basic</h4>
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <Label>Default input</Label>
            <Input placeholder="Enter text…" />
          </div>
          <div className="space-y-2">
            <Label>Ghost variant</Label>
            <Input variant="ghost" placeholder="Ghost input" />
          </div>
          <div className="space-y-2">
            <Label>Disabled</Label>
            <Input placeholder="Disabled" disabled />
          </div>
        </div>
      </div>

      <div>
        <h4 className="mb-4 font-medium">Sizes</h4>
        <div className="space-y-4">
          {(["xs", "sm", "default", "md", "lg"] as const).map((s) => (
            <div key={s} className="space-y-2">
              <Label className="capitalize">{s}</Label>
              <Input size={s} placeholder={`${s} input`} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="mb-4 font-medium">Types</h4>
        <div className="grid grid-cols-1 gap-4">
          {(
            [
              ["text", "Text"],
              ["email", "you@example.com"],
              ["password", "Password"],
              ["number", "123"],
            ] as const
          ).map(([type, placeholder]) => (
            <div key={type} className="space-y-2">
              <Label className="capitalize">{type}</Label>
              <Input type={type} placeholder={placeholder} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CurrencyInputSample() {
  const [amount, setAmount] = useState<number | undefined>(0);

  return (
    <div className="space-y-6">
      <div>
        <h4 className="mb-4 font-medium">Basic</h4>
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <Label>PHP amount</Label>
            <Input.Currency value={amount} onChange={setAmount} placeholder="0.00" />
            <p className="text-gray-500 text-xs">
              displayAmount: {displayAmount(amount ?? 0, false, "PHP")}
            </p>
          </div>
          <div className="space-y-2">
            <Label>Allow negative</Label>
            <Input.Currency
              value={amount}
              onChange={setAmount}
              allowNegativeValue
              placeholder="0.00"
            />
          </div>
        </div>
      </div>

      <div>
        <h4 className="mb-4 font-medium">Sizes</h4>
        <div className="space-y-4">
          {(["sm", "default", "md", "lg"] as const).map((s) => (
            <div key={s} className="space-y-2">
              <Label className="capitalize">{s}</Label>
              <Input.Currency
                value={amount ?? 0}
                onChange={setAmount}
                size={s}
                placeholder="0.00"
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="mb-4 font-medium">Alignment</h4>
        <div className="grid grid-cols-1 gap-4">
          {(["left", "center", "right"] as const).map((a) => (
            <div key={a} className="space-y-2">
              <Label className="capitalize">{a}</Label>
              <Input.Currency
                value={amount ?? 0}
                onChange={setAmount}
                align={a}
                placeholder="0.00"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NumberInputSample() {
  const [quantity, setQuantity] = useState(0);
  const [count, setCount] = useState(42);

  return (
    <div className="space-y-6">
      <div>
        <h4 className="mb-4 font-medium">Basic</h4>
        <Input.Number value={quantity} onChange={(v) => setQuantity(v ?? 0)} placeholder="0" />
        <p className="mt-2 text-gray-500 text-xs">Value: {quantity}</p>
      </div>

      <div>
        <h4 className="mb-4 font-medium">Min / max</h4>
        <Input.Number
          value={quantity}
          onChange={(v) => setQuantity(v ?? 0)}
          min={0}
          max={100}
          placeholder="0–100"
        />
      </div>

      <div>
        <h4 className="mb-4 font-medium">Alignment & sizes</h4>
        <div className="space-y-3">
          {(["left", "center", "right"] as const).map((a) => (
            <Input.Number
              key={a}
              value={count}
              onChange={(v) => setCount(v ?? 0)}
              align={a}
              placeholder="0"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function CurrencyFormExample() {
  const formSchema = z.object({
    amount: z.number().min(0, { message: "Amount must be positive." }),
    note: z.string().optional(),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { amount: 0, note: "" },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(() => null)} className="space-y-4">
        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Amount</FormLabel>
              <FormControl>
                <Input.Currency
                  {...field}
                  placeholder="0.00"
                  allowNegativeValue={false}
                  maxValue={1_000_000}
                />
              </FormControl>
              
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Note</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Optional" />
              </FormControl>
              
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full">
          Submit
        </Button>
      </form>
    </Form>
  );
}

export function DesignSystemPage() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date(2026, 2, 18));
  const [deploymentTarget, setDeploymentTarget] = useState("staging");
  const [notifyAssignee, setNotifyAssignee] = useState(true);
  const [includeSummary, setIncludeSummary] = useState(false);
  const [messageDensity, setMessageDensity] = useState("comfortable");
  const [confidence, setConfidence] = useState(72);
  const [pinSummary, setPinSummary] = useState(true);
  const [editorMarks, setEditorMarks] = useState<string[]>(["bold", "underline"]);
  const [demoFormStatus, setDemoFormStatus] = useState("Draft not submitted yet.");

  const demoForm = useForm({
    defaultValues: {
      projectName: "Dumadine design tokens",
      ownerEmail: "hello@dumadine.com",
      visibility: "internal",
      summary: "Preview shared primitives from @workspace/ui with customer app chrome.",
      notifyStakeholders: true,
    },
  });

  const handleDemoFormSubmit = demoForm.handleSubmit((values) => {
    setDemoFormStatus(`Saved ${values.projectName} for ${values.visibility} review.`);
  });

  return (
    <div className="flex min-h-screen flex-col bg-muted/35">
      <div className="min-h-full flex-1">
        <header className="border-b bg-background/90 px-4 py-3 backdrop-blur md:px-6">
          <div className="mx-auto flex w-full flex-col gap-3">
            <Breadcrumb className="hidden sm:block">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/">Home</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Design system</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        <main className="mx-auto p-4 pb-16">
          <div className="columns-1 gap-4 space-y-4 md:columns-2 xl:columns-3 2xl:columns-4">
            <DemoTile
              title="Typography & palette"
              description="Design tokens from globals.css — typography and core semantic colors."
            >
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="font-semibold text-2xl tracking-tight">
                    Designing with rhythm and hierarchy.
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Strong typography and sensible spacing do more work than decorative noise.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {paletteSwatches.map((swatch) => (
                    <div key={swatch} className="space-y-2">
                      <div className={cn("h-10  border", swatch)} />
                      <p className="truncate text-muted-foreground text-xs">
                        {swatch.replace("bg-", "")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="w-full">
                <Button variant="outline" className="w-full">
                  Sample button
                </Button>
              </div>
            </DemoTile>

            <DemoTile title="Action toolbar" description="Dense controls without clutter.">
              <div className="space-y-4">
                <ButtonGroup>
                  <Button variant="outline" size="icon-sm" aria-label="Notifications">
                    <Bell className="size-4" />
                  </Button>
                  <Button variant="outline" size="icon-sm" aria-label="Calendar">
                    <CalendarDays className="size-4" />
                  </Button>
                  <Button variant="outline" size="icon-sm" aria-label="Users">
                    <Users className="size-4" />
                  </Button>
                  <Button variant="outline" size="icon-sm" aria-label="More">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </ButtonGroup>

                <div className="flex flex-wrap gap-2">
                  <Button>Primary</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="destructive">Destructive</Button>
                  <Button variant="ghost">Ghost</Button>
                </div>

                <div className="relative flex h-9 w-full items-center px-1 border border-input">
                  <Input
                    placeholder="Search components"
                    className="flex-1 border-0 shadow-none ring-0 focus-visible:ring-0"
                  />
                  <div className="pr-2 text-muted-foreground">
                    <Search className="size-4" />
                  </div>
                </div>
              </div>
            </DemoTile>

            <DemoTile
              title="Buttons"
              description="Variants, text sizes, and icon-only affordances."
              action={
                <Button>
                  <Sparkles className="size-4" />
                  Add
                </Button>
              }
              footer={
                <div className="flex w-full items-center justify-between text-muted-foreground text-xs">
                  <span>@workspace/ui variants</span>
                  <span>4 text sizes + 4 icon sizes</span>
                </div>
              }
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <SectionLabel>Variants</SectionLabel>
                  <div className="flex flex-wrap gap-2">
                    {buttonVariantRows.map(([variant, label]) => (
                      <Button key={variant} variant={variant}>
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <SectionLabel>Text sizes</SectionLabel>
                  <div className="flex flex-wrap items-center gap-2">
                    {buttonSizeRows.map(([size, label]) => (
                      <Button key={size} variant="outline" size={size}>
                        {label} button
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <SectionLabel>Icon buttons</SectionLabel>
                  <ButtonGroup>
                    <Button variant="outline" size="icon-xs" aria-label="Notifications">
                      <Bell className="size-3" />
                    </Button>
                    <Button variant="outline" size="icon-sm" aria-label="Calendar">
                      <CalendarDays className="size-4" />
                    </Button>
                    <Button variant="outline" size="icon" aria-label="Users">
                      <Users className="size-4" />
                    </Button>
                    <Button variant="outline" size="icon-lg" aria-label="More actions">
                      <MoreHorizontal className="size-5" />
                    </Button>
                  </ButtonGroup>
                </div>
              </div>
            </DemoTile>

            <DemoTile
              title="Badges"
              description="Status chips at a glance."
              footer={
                <div className="flex w-full items-center justify-between text-muted-foreground text-xs">
                  <span>Badge variants</span>
                  <span>@workspace/ui</span>
                </div>
              }
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <SectionLabel>Variants</SectionLabel>
                  <div className="flex flex-wrap gap-2">
                    {badgeVariantRows.map(([variant, label]) => (
                      <Badge key={variant} variant={variant}>
                        <Sparkles className="size-3" />
                        {label}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </DemoTile>

            <DemoTile
              title="Typography"
              description="Heading and subheading hierarchy before card chrome."
            >
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="font-semibold text-3xl tracking-tight">
                    Shared UI primitives with stronger defaults.
                  </p>
                  <p className="max-w-xl text-muted-foreground text-sm">
                    The heading establishes intent; the subheading explains scope without reading
                    like accidental body copy.
                  </p>
                </div>
                <Separator />
                <div className="space-y-1">
                  <p className="font-semibold text-xl tracking-tight">Compact section title</p>
                  <p className="text-muted-foreground text-sm">
                    For secondary groupings in dense dashboards and settings.
                  </p>
                </div>
              </div>
            </DemoTile>

            <DemoTile
              title="Environment variables"
              description="Example deployment card layout."
              action={<Badge variant="outline">3 variables</Badge>}
              footer={
                <div className="flex w-full items-center justify-between">
                  <Button variant="outline" size="sm">
                    Edit
                  </Button>
                  <Button size="sm">Deploy</Button>
                </div>
              }
            >
              <div className="space-y-2">
                {[
                  ["DATABASE_URL", "•••••••••••••••••••••••••"],
                  ["VITE_API_BASE_URL", "https://api.example.com"],
                  ["CLERK_SECRET_KEY", "•••••••••••••••••••••••••"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between xl border px-3 py-2"
                  >
                    <span className="font-medium text-xs">{label}</span>
                    <span className="max-w-[11rem] truncate text-muted-foreground text-xs">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </DemoTile>

            <DemoTile title="Feedback" description="Select, textarea, and primary action.">
              <div className="space-y-3">
                <Select
                  defaultValue="billing"
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Topic" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="billing">Billing</SelectItem>
                    <SelectItem value="product">Product</SelectItem>
                    <SelectItem value="support">Support</SelectItem>
                  </SelectContent>
                </Select>
                <Textarea placeholder="Your feedback…" className="min-h-24" />
                <Button size="sm">Submit</Button>
              </div>
            </DemoTile>

            <DemoTile
              title="Form primitives"
              description="react-hook-form + form primitives from @workspace/ui."
              footer={
                <div className="w-full xl border bg-muted/20 px-3 py-2 text-muted-foreground text-sm">
                  {demoFormStatus}
                </div>
              }
            >
              <Form {...demoForm}>
                <form onSubmit={handleDemoFormSubmit} className="space-y-4">
                  <FormField
                    control={demoForm.control}
                    name="projectName"
                    rules={{ required: "Project name is required." }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project name</FormLabel>
                        <Input {...field} />
                        <FormDescription>Working title your team will recognize.</FormDescription>
                        
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={demoForm.control}
                    name="ownerEmail"
                    rules={{
                      required: "Owner email is required.",
                      pattern: { value: /\S+@\S+\.\S+/, message: "Enter a valid email." },
                    }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Owner email</FormLabel>
                        <Input {...field} type="email" />
                        
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={demoForm.control}
                    name="visibility"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Visibility</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="internal">Internal</SelectItem>
                            <SelectItem value="client">Client preview</SelectItem>
                            <SelectItem value="public">Public</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Keep previews internal until content is final.
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={demoForm.control}
                    name="summary"
                    rules={{ required: "A short summary helps reviewers." }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Summary</FormLabel>
                        <Textarea {...field} className="min-h-24" />
                        
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={demoForm.control}
                    name="notifyStakeholders"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between xl border px-3 py-3">
                        <div className="space-y-1">
                          <FormLabel className="text-sm">Notify stakeholders</FormLabel>
                          <FormDescription>
                            Send a digest when this demo is saved.
                          </FormDescription>
                        </div>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end">
                    <Button size="sm" type="submit">
                      Save demo
                    </Button>
                  </div>
                </form>
              </Form>
            </DemoTile>

            <DemoTile
              title="Overlays & menus"
              description="Dialogs and menus for real workflow decisions."
              footer={
                <div className="flex w-full items-center justify-between text-muted-foreground text-xs">
                  <span>Target: {deploymentTarget}</span>
                  <span>{notifyAssignee ? "Assignee notified" : "Silent"}</span>
                </div>
              }
            >
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Dialog>
                    <DialogTrigger>
                      <Button variant="outline" size="sm">
                        Open dialog
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[min(90dvh,720px)] overflow-y-auto sm:max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Publish release notes</DialogTitle>
                        <DialogDescription>
                          Review copy, notify collaborators, and publish to the team feed.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-2">
                        <div className="xl border px-3 py-2">
                          <p className="font-medium text-sm">Version 2.4.0</p>
                          <p className="text-muted-foreground text-sm">
                            12 improvements, 3 fixes, one onboarding refresh.
                          </p>
                        </div>
                      </div>
                      <DialogFooter className="gap-2">
                        <DialogClose asChild>
                          <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button>Publish</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <AlertDialog>
                    <AlertDialogTrigger>
                      <Button variant="destructive" size="sm">
                        Destructive confirm
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <div className="mb-2 inline-flex size-10 items-center justify-center md bg-muted">
                          <AlertTriangle className="size-5" />
                        </div>
                        <AlertDialogTitle>Delete draft?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This removes local comments and cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep editing</AlertDialogCancel>
                        <AlertDialogAction variant="destructive">Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <DropdownMenu>
                    <DropdownMenuTrigger>
                      <Button variant="outline" size="sm">
                        Open menu
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Release</DropdownMenuLabel>
                      <DropdownMenuGroup>
                        <DropdownMenuItem>
                          Copy link
                          <DropdownMenuShortcut>⌘C</DropdownMenuShortcut>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          Share
                          <DropdownMenuShortcut>⌘⇧S</DropdownMenuShortcut>
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuCheckboxItem
                        checked={notifyAssignee}
                        onCheckedChange={setNotifyAssignee}
                      >
                        Notify assignee
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={includeSummary}
                        onCheckedChange={setIncludeSummary}
                      >
                        Executive summary
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>Environment</DropdownMenuLabel>
                      <DropdownMenuRadioGroup
                        value={deploymentTarget}
                        onValueChange={setDeploymentTarget}
                      >
                        <DropdownMenuRadioItem value="dev">Development</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="staging">Staging</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="production">
                          Production
                        </DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>Advanced</DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          <DropdownMenuItem>Duplicate config</DropdownMenuItem>
                          <DropdownMenuItem>Archive runbook</DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="xl border bg-muted/20 p-3">
                  <p className="font-medium text-sm">Menu preview</p>
                  <p className="mt-1 text-muted-foreground text-sm">
                    {includeSummary ? "Summary included" : "Summary omitted"} for{" "}
                    {deploymentTarget}.
                  </p>
                </div>
              </div>
            </DemoTile>

            <DemoTile title="Contextual surfaces" description="Tooltip, popover, and hover card.">
              <TooltipProvider>
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Tooltip>
                      <TooltipTrigger>
                        <Button variant="outline" size="icon-sm" aria-label="Security">
                          <ShieldCheck className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Protected by role-based access.</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger>
                        <Button variant="outline" size="icon-sm" aria-label="Global">
                          <Globe className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Visible to workspace admins.</TooltipContent>
                    </Tooltip>

                    <Popover>
                      <PopoverTrigger>
                        <Button variant="outline" size="sm">
                          Quick summary
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start">
                        <div className="mb-2 space-y-1">
                          <p className="font-medium text-sm">Ready to publish</p>
                          <p className="text-muted-foreground text-sm">
                            Two reviewers approved; one checklist item left.
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <StatChip label="Approvals" value="2/3" />
                          <StatChip label="Risk" value="Low" tone="positive" />
                        </div>
                        <Button size="sm" className="mt-3">
                          Open checklist
                        </Button>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <HoverCard>
                    <HoverCardTrigger>
                      <Button variant="ghost" size="xs">
                        @design-system
                      </Button>
                    </HoverCardTrigger>
                    <HoverCardContent className="space-y-2">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>DS</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">Design guild</p>
                          <p className="text-muted-foreground text-xs">
                            Tokens, primitives, release guidance.
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <StatChip label="Open RFCs" value="4" />
                        <StatChip label="Ship rate" value="92%" tone="positive" />
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                </div>
              </TooltipProvider>
            </DemoTile>

            <DemoTile
              title="Selection controls"
              description="Radio, range, toggle, and toggle group."
              footer={
                <div className="grid w-full grid-cols-3 gap-3">
                  <StatChip label="Density" value={messageDensity} />
                  <StatChip label="Threshold" value={`${confidence}%`} />
                  <StatChip
                    label="Pinned"
                    value={pinSummary ? "Yes" : "No"}
                    tone={pinSummary ? "positive" : "default"}
                  />
                </div>
              }
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <SectionLabel>Message density</SectionLabel>
                  <RadioGroup value={messageDensity} onValueChange={setMessageDensity}>
                    {densityRows.map(([value, lbl]) => (
                      <div
                        key={value}
                        className="flex items-center justify-between xl border px-3 py-2.5"
                      >
                        <Label htmlFor={`density-${value}`}>{lbl}</Label>
                        <RadioGroupItem id={`density-${value}`} value={value} />
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <SectionLabel>Confidence</SectionLabel>
                    <span className="text-muted-foreground text-xs">{confidence}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={confidence}
                    onChange={(e) => setConfidence(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>

                <div className="flex items-center justify-between xl border px-3 py-2.5">
                  <div>
                    <p className="font-medium text-sm">Pin summary</p>
                    <p className="text-muted-foreground text-xs">Keep visible while reviewing.</p>
                  </div>
                  <Toggle
                    pressed={pinSummary}
                    onPressedChange={setPinSummary}
                    variant="outline"
                    size="sm"
                  >
                    {pinSummary ? "Pinned" : "Pin"}
                  </Toggle>
                </div>

                <div className="space-y-2">
                  <SectionLabel>Text marks</SectionLabel>
                  <ToggleGroup
                    type="multiple"
                    value={editorMarks}
                    onValueChange={setEditorMarks}
                    variant="outline"
                    size="sm"
                  >
                    <ToggleGroupItem value="bold">Bold</ToggleGroupItem>
                    <ToggleGroupItem value="italic">Italic</ToggleGroupItem>
                    <ToggleGroupItem value="underline">Underline</ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>
            </DemoTile>

            <DemoTile
              title="Scheduling"
              description="Calendar single selection."
              footer={
                <div className="flex w-full justify-between text-muted-foreground text-xs">
                  <span>
                    Selected:{" "}
                    {selectedDate
                      ? selectedDate.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "None"}
                  </span>
                </div>
              }
            >
              <div className="overflow-hidden xl border">
                <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} />
              </div>
            </DemoTile>

            <DemoTile title="Feedback states" description="Alert, spinner, and skeleton.">
              <div className="space-y-4">
                <Alert>
                  <ShieldCheck className="size-4" />
                  <AlertTitle>Deployment scheduled</AlertTitle>
                  <AlertDescription>
                    Admins will receive a summary when the release runs.
                  </AlertDescription>
                </Alert>
                <Alert variant="destructive">
                  <AlertTriangle className="size-4" />
                  <AlertTitle>Action required</AlertTitle>
                  <AlertDescription>
                    A required environment variable is missing in production.
                  </AlertDescription>
                </Alert>
                <div className="xl border p-3">
                  <div className="mb-3 flex items-center gap-2 font-medium text-sm">
                    <Loader2 className="size-4 animate-spin" />
                    Syncing tokens
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-10 w-full xl" />
                  </div>
                </div>
              </div>
            </DemoTile>

            <DemoTile
              title="Traffic channels"
              description="Desktop vs mobile (sample data)."
              footer={
                <div className="grid w-full grid-cols-3 gap-3">
                  <StatChip label="Desktop" value="1,224" />
                  <StatChip label="Mobile" value="860" />
                  <StatChip label="Mix delta" value="+42%" tone="positive" />
                </div>
              }
            >
              <ChartContainer config={trafficConfig} className="h-52 w-full">
                <BarChart data={trafficData} barGap={8}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="desktop" fill="var(--color-desktop)" radius={8} />
                  <Bar dataKey="mobile" fill="var(--color-mobile)" radius={8} />
                </BarChart>
              </ChartContainer>
            </DemoTile>

            <DemoTile
              title="Browser share"
              description="January–June 2026 (sample)"
              action={<Badge variant="outline">Firefox</Badge>}
              footer={
                <div className="w-full space-y-2">
                  <div className="flex items-center justify-between text-muted-foreground text-xs">
                    <span>Firefox</span>
                    <span>31%</span>
                  </div>
                  <Progress value={31} className="h-1.5" />
                </div>
              }
            >
              <div className="grid gap-4 md:grid-cols-[152px_1fr]">
                <div className="mx-auto flex h-36 w-36 items-center justify-center full border">
                  <div className="space-y-1 text-center">
                    <p className="font-semibold text-3xl">935</p>
                    <p className="text-muted-foreground text-xs">Visitors</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <ChartContainer config={browserConfig} className="mx-auto h-36 max-w-[12rem]">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                      <Pie
                        data={browserShare}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={34}
                        outerRadius={54}
                        paddingAngle={3}
                        strokeWidth={0}
                      />
                    </PieChart>
                  </ChartContainer>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {browserShare.map((item) => (
                      <div
                        key={item.name}
                        className="flex items-center justify-between bg-muted/50 px-2.5 py-2"
                      >
                        <span>{item.name}</span>
                        <span className="font-medium">{item.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </DemoTile>

            <DemoTile title="Weekly activity" description="Sample bar visualization.">
              <div className="space-y-4">
                <div className="grid grid-cols-7 gap-2">
                  {fitnessDays.map((day, index) => (
                    <div
                      key={`${day.label}-${String(index)}`}
                      className="xl border bg-muted/30 px-2 py-3 text-center"
                    >
                      <p className="mb-3 text-muted-foreground text-xs">{day.label}</p>
                      <div className="mx-auto flex h-12 w-5 items-end full bg-background p-0.5">
                        <div
                          className="w-full full bg-foreground/70"
                          style={{ height: `${day.value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <Button className="w-full">View details</Button>
              </div>
            </DemoTile>

            <DemoTile title="Workspace modes" description="Tabs and empty state.">
              <Tabs defaultValue="codespaces" className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="codespaces">Remote</TabsTrigger>
                  <TabsTrigger value="local">Local</TabsTrigger>
                </TabsList>
                <TabsContent value="codespaces" className="pt-2">
                  <Empty className="border-muted-foreground/20 bg-muted/20">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <CloudUpload className="size-4" />
                      </EmptyMedia>
                      <EmptyTitle>No remote workspaces</EmptyTitle>
                      <EmptyDescription>
                        Boot this repo in a cloud environment to see it here.
                      </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                      <Button size="sm">Create workspace</Button>
                    </EmptyContent>
                  </Empty>
                </TabsContent>
                <TabsContent value="local" className="pt-2">
                  <div className="xl border p-4">
                    <p className="font-medium">Local ready</p>
                    <p className="mt-1 text-muted-foreground text-sm">
                      Apps and packages linked via the monorepo.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </DemoTile>

            <DemoTile
              title="Book slot"
              description="Sample time-slot picker."
              footer={<Button className="w-full">Book</Button>}
            >
              <div className="space-y-3">
                <p className="font-medium text-sm">Available March 18, 2026</p>
                <div className="flex flex-wrap gap-2">
                  {["9:00 AM", "10:30 AM", "11:00 AM", "1:30 PM"].map((time) => (
                    <Button
                      key={time}
                      variant={time === "10:30 AM" ? "default" : "outline"}
                      size="sm"
                    >
                      {time}
                    </Button>
                  ))}
                </div>
                <Input placeholder="Notes (optional)" />
              </div>
            </DemoTile>

            <DemoTile title="File upload" description="Drop zone pattern.">
              <div className="2xl border border-dashed px-4 py-8 text-center">
                <div className="mx-auto mb-4 flex size-10 items-center justify-center full bg-muted">
                  <CloudUpload className="size-5 text-muted-foreground" />
                </div>
                <p className="font-medium">Upload files</p>
                <p className="mt-1 text-muted-foreground text-sm">PNG, JPG, PDF up to 10MB</p>
                <Button className="mt-4" size="sm">
                  Browse
                </Button>
              </div>
            </DemoTile>

            <DemoTile
              title="Invite team"
              description="Email + role rows."
              footer={<Button className="w-full">Send invites</Button>}
            >
              <div className="space-y-3">
                {[
                  ["alex@example.com", "editor"],
                  ["sam@example.com", "viewer"],
                ].map(([email, role]) => (
                  <div key={email} className="grid gap-2 sm:grid-cols-[1fr_110px]">
                    <Input defaultValue={email} />
                    <Select
                      defaultValue={role}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="editor">Editor</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                        <SelectItem value="billing">Billing</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                <Button variant="outline" className="w-full" size="sm">
                  Add another
                </Button>
              </div>
            </DemoTile>

            <DemoTile
              title="Sleep report"
              description="Sample segmented bars."
              footer={
                <div className="flex w-full items-center justify-between">
                  <Badge variant="secondary">Good</Badge>
                  <Button variant="outline" size="sm">
                    Details
                  </Button>
                </div>
              }
            >
              <div className="flex items-end justify-between gap-3">
                {sleepBlocks.map((block) => (
                  <div key={block.label} className="flex flex-1 flex-col items-center gap-2">
                    <div className="flex h-24 w-4 items-end full bg-muted/70 p-0.5">
                      <div
                        className="w-full full bg-foreground/70"
                        style={{ height: `${block.value}%` }}
                      />
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-xs">{block.label}</p>
                      <p className="text-muted-foreground text-xs">{block.value} min</p>
                    </div>
                  </div>
                ))}
              </div>
            </DemoTile>

            <DemoTile
              title="Analytics"
              description="Area chart (sample)"
              action={<Badge variant="secondary">+10%</Badge>}
              footer={
                <div className="flex w-full justify-end">
                  <Button variant="outline" size="sm">
                    View analytics
                  </Button>
                </div>
              }
            >
              <ChartContainer config={visitorsConfig} className="h-40 w-full">
                <AreaChart data={visitorData}>
                  <defs>
                    <linearGradient id="visitors-fill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-visitors)" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="var(--color-visitors)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="visitors"
                    stroke="var(--color-visitors)"
                    fill="url(#visitors-fill)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            </DemoTile>

            <DemoTile
              title="Profile"
              description="Form-like profile card."
              footer={<Button>Save</Button>}
            >
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <SectionLabel>Name</SectionLabel>
                  <Input defaultValue="Dumadine" />
                </div>
                <div className="space-y-1.5">
                  <SectionLabel>Public email</SectionLabel>
                  <Select
                    defaultValue="email"
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">hello@dumadine.com</SelectItem>
                      <SelectItem value="hidden">Hidden</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <SectionLabel>Bio</SectionLabel>
                  <Textarea placeholder="Short bio" />
                </div>
              </div>
            </DemoTile>

            <DemoTile
              title="Invoice"
              description="Table + actions"
              action={<Badge variant="outline">Pending</Badge>}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoiceRows.map((row) => (
                    <TableRow key={row.item}>
                      <TableCell className="whitespace-normal">{row.item}</TableCell>
                      <TableCell>{row.qty}</TableCell>
                      <TableCell>{row.rate}</TableCell>
                      <TableCell className="text-right">{row.amount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3}>Total due</TableCell>
                    <TableCell className="text-right">₱121,890.00</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
              <Separator />
              <div className="flex items-center justify-between gap-2">
                <Button variant="outline" size="sm">
                  Download PDF
                </Button>
                <Button size="sm">Pay now</Button>
              </div>
            </DemoTile>

            <DemoTile title="Shortcuts" description="Keyboard hints.">
              <div className="space-y-3">
                <div className="relative flex h-9 w-full items-center md border border-input">
                  <Input
                    placeholder="Search"
                    className="flex-1 border-0 shadow-none ring-0 focus-visible:ring-0"
                  />
                  <div className="flex items-center gap-1 pr-2">
                    <KbdInline>⌘</KbdInline>
                    <KbdInline>K</KbdInline>
                  </div>
                </div>
                {shortcutRows.map((shortcut) => (
                  <div
                    key={shortcut.label}
                    className="flex items-center justify-between xl border px-3 py-2.5"
                  >
                    <span className="text-sm">{shortcut.label}</span>
                    <div className="inline-flex items-center gap-1">
                      <KbdInline>⌘</KbdInline>
                      <KbdInline>{shortcut.key}</KbdInline>
                    </div>
                  </div>
                ))}
              </div>
            </DemoTile>

            <DemoTile
              title="Contributions"
              description="Checkbox + switch row."
              footer={<Button size="sm">Save</Button>}
            >
              <div className="space-y-4">
                <div className="flex items-start gap-3 xl border p-3">
                  <Checkbox defaultChecked className="mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-medium text-sm">Make profile private</p>
                    <p className="text-muted-foreground text-sm">Hide public activity totals.</p>
                  </div>
                </div>
                <div className="flex items-center justify-between xl bg-muted/40 px-3 py-2.5">
                  <div>
                    <p className="font-medium text-sm">Anomaly alerts</p>
                    <p className="text-muted-foreground text-xs">
                      Monitor for suspicious spikes.
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </DemoTile>

            <DemoTile title="Contributors" description="Avatar stack + callout.">
              <div className="space-y-4">
                <div className="-space-x-2 flex">
                  {["AL", "SM", "JR", "MC", "PV", "QN"].map((name) => (
                    <Avatar key={name} className="ring-2 ring-background">
                      <AvatarFallback>{name}</AvatarFallback>
                    </Avatar>
                  ))}
                  <div className="relative flex size-8 shrink-0 items-center justify-center full bg-muted font-medium text-muted-foreground text-sm ring-2 ring-background">
                    +12
                  </div>
                </div>
                <div className="xl border border-dashed p-4">
                  <p className="font-medium text-sm">Ship with confidence</p>
                  <ul className="mt-2 space-y-2 text-muted-foreground text-sm">
                    <li>Reviews with full product context.</li>
                    <li>Validated flows before release.</li>
                    <li>Monitoring before incidents escalate.</li>
                  </ul>
                </div>
              </div>
            </DemoTile>

            <DemoTile
              title="Visitors"
              description="Line chart"
              action={<Badge variant="outline">+2% MoM</Badge>}
            >
              <ChartContainer config={visitorsConfig} className="h-44 w-full">
                <LineChart data={visitorData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="visitors"
                    stroke="var(--color-visitors)"
                    strokeWidth={2.5}
                    dot={false}
                  />
                </LineChart>
              </ChartContainer>
            </DemoTile>

            <DemoTile title="404 pattern" description="Empty state + search.">
              <Empty className="border-muted-foreground/20 bg-muted/10">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Info className="size-4" />
                  </EmptyMedia>
                  <EmptyTitle>Page not found</EmptyTitle>
                  <EmptyDescription>
                    Empty states deserve the same care as happy paths.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <div className="relative flex h-9 w-full items-center md border border-input">
                    <div className="pl-2 text-muted-foreground">
                      <Search className="size-4" />
                    </div>
                    <Input
                      placeholder="Search…"
                      className="flex-1 border-0 shadow-none ring-0 focus-visible:ring-0"
                    />
                  </div>
                  <Button className="w-full">Home</Button>
                </EmptyContent>
              </Empty>
            </DemoTile>

            <DemoTile
              title="Upsell card"
              description="Gradient panel + stats."
              footer={
                <div className="flex w-full items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <ShieldCheck className="size-3.5" />
                    Plan upgrade
                  </div>
                  <Button size="sm">Upgrade</Button>
                </div>
              }
            >
              <div className="space-y-3">
                <div className="2xl bg-gradient-to-br from-foreground/8 via-foreground/4 to-transparent p-4">
                  <p className="font-medium text-sm">Monitoring defaults</p>
                  <p className="mt-1 text-muted-foreground text-sm">
                    Useful baselines without hand-building every dashboard.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <StatChip label="Alert rules" value="12" />
                  <StatChip label="Resolved" value="98.4%" tone="positive" />
                </div>
              </div>
            </DemoTile>

            <DemoTile
              title="Global status"
              description="Progress list."
              action={<Badge variant="secondary">Healthy</Badge>}
            >
              <div className="space-y-3">
                {(
                  [
                    ["API latency", 92],
                    ["Background jobs", 76],
                    ["Storage", 63],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Globe className="size-4 text-muted-foreground" />
                        <span>{label}</span>
                      </div>
                      <span className="font-medium">{value}%</span>
                    </div>
                    <Progress value={value} />
                  </div>
                ))}
              </div>
            </DemoTile>

            <DemoTile
              title="Launch checklist"
              description="Checklist rows."
              footer={<Button className="w-full">Finish review</Button>}
            >
              <div className="space-y-3">
                {(
                  [
                    ["Design QA", true],
                    ["Performance", true],
                    ["Error monitoring", false],
                  ] as const
                ).map(([label, checked]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between xl border px-3 py-2.5"
                  >
                    <span className="text-sm">{label}</span>
                    <Checkbox checked={checked} />
                  </div>
                ))}
              </div>
            </DemoTile>

            <DemoTile title="Next release" description="Closing CTA pattern.">
              <div className="space-y-4">
                <div className="flex items-start gap-3 2xl border p-4">
                  <div className="xl bg-primary/10 p-2 text-primary">
                    <Palette className="size-4" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium">Polish the design system deliberately</p>
                    <p className="text-muted-foreground text-sm">
                      If the showcase looks accidental, people assume the product is too.
                    </p>
                  </div>
                </div>
                <Button className="w-full justify-between">
                  Review spec
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </DemoTile>

            <DemoTile title="Date picker" description="DatePicker + calendar range demos.">
              <DatePickerSample />
            </DemoTile>

            <DemoTile title="Input" description="Variants and sizes from @workspace/ui.">
              <InputSample />
            </DemoTile>

            <DemoTile title="Currency input" description="PHP formatting via displayAmount.">
              <CurrencyInputSample />
            </DemoTile>

            <DemoTile title="Number input" description="Bounds and alignment.">
              <NumberInputSample />
            </DemoTile>

            <DemoTile title="Currency form" description="react-hook-form + Input.Currency.">
              <CurrencyFormExample />
            </DemoTile>
          </div>
          <Card className="mb-6 break-inside-avoid">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="size-5 text-primary" aria-hidden />
                Colors
              </CardTitle>
              <CardDescription className="text-pretty">
                Default Tailwind exposes named colors as CSS variables (for example{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">var(--color-sky-500)</code>
                ) and as utilities such as{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">bg-sky-500</code>. Brand
                ramps below are defined in{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">globals.css</code>. See the{" "}
                <a
                  href="https://tailwindcss.com/docs/colors"
                  className="text-primary underline-offset-4 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  Tailwind CSS colors
                </a>{" "}
                reference for the full default palette.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-10">
              <div className="space-y-3">
                <SectionLabel>Semantic theme</SectionLabel>
                <p className="text-muted-foreground text-sm">
                  Mapped in <code className="text-xs">@theme inline</code> — use{" "}
                  <code className="text-xs">bg-primary</code>,{" "}
                  <code className="text-xs">text-muted-foreground</code>, etc.
                </p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                  {semanticThemeSwatches.map(({ label: token, className }) => (
                    <div key={token} className="space-y-1.5">
                      <div className={cn("h-10 xl border", className)} title={token} />
                      <p className="truncate text-muted-foreground text-[10px]">{token}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <SectionLabel>Chart & data</SectionLabel>
                <div className="flex flex-wrap gap-3">
                  {chartSwatches.map((key) => (
                    <div key={key} className="flex flex-col items-center gap-1">
                      <div
                        className="h-10 w-14 xl border border-black/10 dark:border-white/15"
                        style={{ backgroundColor: `var(--color-${key})` }}
                        title={`--color-${key}`}
                      />
                      <span className="text-muted-foreground text-[10px]">{key}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <SectionLabel>Opacity on primary</SectionLabel>
                <p className="text-muted-foreground text-sm">
                  Tailwind opacity modifiers, same idea as{" "}
                  <a
                    href="https://tailwindcss.com/docs/colors#adjusting-opacity"
                    className="text-primary underline-offset-4 hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    adjusting opacity
                  </a>
                  .
                </p>
                <div className="flex flex-wrap gap-2">
                  {(["10", "20", "40", "60", "80"] as const).map((step) => (
                    <div key={step} className="space-y-1 text-center">
                      <div
                        className={cn("h-10 w-14 xl border", `bg-primary/${step}`)}
                        title={`bg-primary/${step}`}
                      />
                      <span className="text-muted-foreground text-[10px]">{step}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-6">
                <div>
                  <SectionLabel>Default palette (sample hues)</SectionLabel>
                  <p className="mt-1 text-muted-foreground text-sm">
                    Eleven steps per hue: 50 (lightest) through 950 (darkest), matching Tailwind’s
                    scale.
                  </p>
                </div>
                <div className="space-y-6">
                  {tailwindHueScales.map(([name, label]) => (
                    <ColorHueScaleRow
                      key={name}
                      name={name}
                      label={label}
                      shades={tailwindScaleSteps}
                      columnsClass="min-w-[320px] grid-cols-11 sm:min-w-0"
                    />
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-6">
                <div>
                  <SectionLabel>Brand extended ramps</SectionLabel>
                  <p className="mt-1 text-muted-foreground text-sm">
                    Defined on <code className="text-xs">:root</code> in{" "}
                    <code className="text-xs">@workspace/ui</code> — reference with{" "}
                    <code className="text-xs">var(--color-tealdeep-500)</code> or arbitrary
                    utilities such as <code className="text-xs">bg-[var(--color-coral-400)]</code>
                    .
                  </p>
                </div>
                <div className="space-y-6">
                  {brandPalettes.map(([name, label]) => (
                    <ColorHueScaleRow
                      key={name}
                      name={name}
                      label={label}
                      shades={brandPaletteSteps}
                      columnsClass="min-w-[280px] grid-cols-10 sm:min-w-0"
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
