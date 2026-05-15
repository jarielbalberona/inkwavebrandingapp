"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import { cn } from "@workspace/ui/lib/utils"

type ComboboxChangeDetails = {
  event?: Event
  reason?: string
}

type ComboboxProps<Value, Multiple extends boolean | undefined = false> = {
  children?: React.ReactNode
  defaultInputValue?: React.ComponentProps<"input">["defaultValue"]
  defaultOpen?: boolean
  defaultValue?: Multiple extends true ? Value[] : Value | null
  disabled?: boolean
  filter?:
    | null
    | ((
        itemValue: Value,
        query: string,
        itemToString?: (itemValue: Value) => string
      ) => boolean)
  filteredItems?: readonly Value[]
  inputValue?: React.ComponentProps<"input">["value"]
  isItemEqualToValue?: (itemValue: Value, value: Value) => boolean
  itemToStringLabel?: (itemValue: Value) => string
  itemToStringValue?: (itemValue: Value) => string
  items?: readonly Value[]
  multiple?: Multiple
  name?: string
  onInputValueChange?: (inputValue: string, eventDetails: ComboboxChangeDetails) => void
  onOpenChange?: (open: boolean, eventDetails: ComboboxChangeDetails) => void
  onValueChange?: (
    value: (Multiple extends true ? Value[] : Value) | (Multiple extends true ? never : null),
    eventDetails: ComboboxChangeDetails
  ) => void
  open?: boolean
  readOnly?: boolean
  required?: boolean
  value?: (Multiple extends true ? Value[] : Value) | null
}

type ComboboxContextValue = {
  activeIndex: number
  disabled: boolean
  empty: boolean
  filteredItems: readonly unknown[]
  getItemLabel: (item: unknown) => string
  getItemValue: (item: unknown) => string
  highlightedIndex: number
  inputId: string
  inputValue: string
  isSelected: (item: unknown) => boolean
  listId: string
  open: boolean
  popupRef: React.RefObject<HTMLDivElement | null>
  readOnly: boolean
  required: boolean
  resetPlaceholderSelectionInput: (event?: Event) => void
  selectedLabel: string
  selectItem: (item: unknown, event?: Event) => void
  setHighlightedIndex: (index: number) => void
  setInputValue: (value: string, event?: Event) => void
  setOpen: (open: boolean, event?: Event, reason?: string) => void
  valueString: string
}

const ComboboxContext = React.createContext<ComboboxContextValue | null>(null)

function useComboboxContext(component: string) {
  const context = React.useContext(ComboboxContext)

  if (!context) {
    throw new Error(`${component} must be used inside <Combobox>.`)
  }

  return context
}

function Combobox<Value, Multiple extends boolean | undefined = false>({
  children,
  defaultInputValue,
  defaultOpen = false,
  disabled = false,
  filter,
  filteredItems,
  inputValue,
  isItemEqualToValue,
  itemToStringLabel,
  itemToStringValue,
  items = [],
  multiple,
  name,
  onInputValueChange,
  onOpenChange,
  onValueChange,
  open,
  readOnly = false,
  required = false,
  value,
}: ComboboxProps<Value, Multiple>) {
  const generatedId = React.useId()
  const inputId = `${generatedId}-input`
  const listId = `${generatedId}-list`
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const popupRef = React.useRef<HTMLDivElement | null>(null)
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)
  const [uncontrolledInputValue, setUncontrolledInputValue] = React.useState(
    typeof defaultInputValue === "string" ? defaultInputValue : ""
  )
  const [highlightedIndex, setHighlightedIndex] = React.useState(0)
  const isOpen = open ?? uncontrolledOpen
  const currentInputValue =
    typeof inputValue === "string" ? inputValue : uncontrolledInputValue

  const getItemLabel = React.useCallback(
    (item: unknown) => {
      if (item == null) {
        return ""
      }

      if (itemToStringLabel) {
        return itemToStringLabel(item as Value) ?? ""
      }

      if (typeof item === "object" && "label" in item) {
        return String((item as { label?: unknown }).label ?? "")
      }

      return String(item)
    },
    [itemToStringLabel]
  )

  const getItemValue = React.useCallback(
    (item: unknown) => {
      if (item == null) {
        return ""
      }

      if (itemToStringValue) {
        return itemToStringValue(item as Value) ?? ""
      }

      if (typeof item === "object" && "value" in item) {
        return String((item as { value?: unknown }).value ?? "")
      }

      return getItemLabel(item)
    },
    [getItemLabel, itemToStringValue]
  )

  const computedFilteredItems = React.useMemo(() => {
    if (filteredItems) {
      return filteredItems
    }

    if (filter === null || currentInputValue.trim() === "") {
      return items
    }

    const query = currentInputValue.trim().toLocaleLowerCase()

    return items.filter((item) => {
      if (filter) {
        return filter(item, currentInputValue, getItemLabel)
      }

      return getItemLabel(item).toLocaleLowerCase().includes(query)
    })
  }, [currentInputValue, filter, filteredItems, getItemLabel, items])

  const setOpen = React.useCallback(
    (nextOpen: boolean, event?: Event, reason?: string) => {
      if (disabled || readOnly) {
        return
      }

      if (open === undefined) {
        setUncontrolledOpen(nextOpen)
      }

      onOpenChange?.(nextOpen, { event, reason })
    },
    [disabled, onOpenChange, open, readOnly]
  )

  const setInput = React.useCallback(
    (nextValue: string, event?: Event) => {
      if (inputValue === undefined) {
        setUncontrolledInputValue(nextValue)
      }

      onInputValueChange?.(nextValue, { event, reason: "input" })
      setHighlightedIndex(0)
    },
    [inputValue, onInputValueChange]
  )

  const isSelected = React.useCallback(
    (item: unknown) => {
      if (value == null || multiple) {
        return false
      }

      if (isItemEqualToValue) {
        return isItemEqualToValue(item as Value, value as Value)
      }

      return Object.is(item, value)
    },
    [isItemEqualToValue, multiple, value]
  )

  const hasPlaceholderSelection = React.useMemo(() => {
    if (multiple || value == null) {
      return false
    }

    const itemValue = getItemValue(value)
    const objectValue =
      typeof value === "object" && value !== null
        ? (value as Record<string, unknown>)
        : null

    return (
      itemValue === "" ||
      itemValue === "__none__" ||
      (objectValue !== null &&
        (("item" in objectValue && objectValue.item == null) ||
          ("bundle" in objectValue && objectValue.bundle == null)))
    )
  }, [getItemValue, multiple, value])

  const resetPlaceholderSelectionInput = React.useCallback(
    (event?: Event) => {
      if (!hasPlaceholderSelection) {
        return
      }

      setInput("", event)
    },
    [hasPlaceholderSelection, setInput]
  )

  const selectItem = React.useCallback(
    (item: unknown, event?: Event) => {
      if (disabled || readOnly || multiple) {
        return
      }

      const nextValue = item as (Multiple extends true ? never : Value)
      const label = getItemLabel(item)

      onValueChange?.(nextValue, { event, reason: "item-select" })
      setInput(label, event)
      setOpen(false, event, "item-select")
    },
    [disabled, getItemLabel, multiple, onValueChange, readOnly, setInput, setOpen]
  )

  React.useEffect(() => {
    if (isOpen || inputValue !== undefined) {
      return
    }

    if (!multiple && value != null) {
      setUncontrolledInputValue(getItemLabel(value))
    }
  }, [getItemLabel, inputValue, isOpen, multiple, value])

  React.useEffect(() => {
    function handleDocumentPointerDown(event: PointerEvent) {
      const target = event.target as Node

      if (
        !rootRef.current?.contains(target) &&
        !popupRef.current?.contains(target)
      ) {
        setOpen(false, event, "outside-press")
      }
    }

    if (!isOpen) {
      return
    }

    document.addEventListener("pointerdown", handleDocumentPointerDown)

    return () => {
      document.removeEventListener("pointerdown", handleDocumentPointerDown)
    }
  }, [isOpen, setOpen])

  const context = React.useMemo<ComboboxContextValue>(
    () => ({
      activeIndex: Math.min(
        highlightedIndex,
        Math.max(computedFilteredItems.length - 1, 0)
      ),
      disabled,
      empty: computedFilteredItems.length === 0,
      filteredItems: computedFilteredItems,
      getItemLabel,
      getItemValue,
      highlightedIndex,
      inputId,
      inputValue: currentInputValue,
      isSelected,
      listId,
      open: isOpen,
      popupRef,
      readOnly,
      required,
      resetPlaceholderSelectionInput,
      selectedLabel: !multiple && value != null ? getItemLabel(value) : "",
      selectItem,
      setHighlightedIndex,
      setInputValue: setInput,
      setOpen,
      valueString: !multiple && value != null ? getItemValue(value) : "",
    }),
    [
      computedFilteredItems,
      currentInputValue,
      disabled,
      getItemLabel,
      getItemValue,
      highlightedIndex,
      inputId,
      isOpen,
      isSelected,
      listId,
      multiple,
      readOnly,
      required,
      resetPlaceholderSelectionInput,
      selectItem,
      setInput,
      setOpen,
      value,
    ]
  )

  return (
    <ComboboxContext.Provider value={context}>
      <div data-slot="combobox-root" className="relative" ref={rootRef}>
        {children}
        {name ? (
          <input
            aria-hidden="true"
            className="hidden"
            name={name}
            readOnly
            required={required}
            tabIndex={-1}
            value={context.valueString}
          />
        ) : null}
      </div>
    </ComboboxContext.Provider>
  )
}

function ComboboxValue({ children }: { children?: React.ReactNode }) {
  const context = useComboboxContext("ComboboxValue")

  return (
    <span data-slot="combobox-value">
      {children ?? context.inputValue}
    </span>
  )
}

function ComboboxTrigger({
  className,
  children,
  disabled,
  onClick,
  ...props
}: React.ComponentProps<"button">) {
  const context = useComboboxContext("ComboboxTrigger")
  const isDisabled = disabled || context.disabled

  return (
    <button
      data-slot="combobox-trigger"
      className={cn("[&_svg:not([class*='size-'])]:size-3.5", className)}
      disabled={isDisabled}
      type="button"
      onClick={(event) => {
        onClick?.(event)
        context.setOpen(!context.open, event.nativeEvent, "trigger-press")
      }}
      {...props}
    >
      {children}
      <ChevronDownIcon className="pointer-events-none size-3.5 text-muted-foreground" />
    </button>
  )
}

function ComboboxClear({
  className,
  disabled,
  onClick,
  ...props
}: React.ComponentProps<typeof InputGroupButton>) {
  const context = useComboboxContext("ComboboxClear")
  const isDisabled = disabled || context.disabled || context.inputValue === ""

  return (
    <InputGroupButton
      data-slot="combobox-clear"
      variant="ghost"
      size="icon-xs"
      className={cn(className)}
      disabled={isDisabled}
      onClick={(event) => {
        onClick?.(event)
        context.setInputValue("", event.nativeEvent)
        context.selectItem(null, event.nativeEvent)
        context.setOpen(true, event.nativeEvent, "clear")
      }}
      {...props}
    >
      <XIcon className="pointer-events-none" />
    </InputGroupButton>
  )
}

function ComboboxInput({
  className,
  children,
  disabled = false,
  showTrigger = true,
  showClear = false,
  onBlur,
  onChange,
  onClick,
  onFocus,
  onKeyDown,
  value: _value,
  ...props
}: Omit<React.ComponentProps<"input">, "size" | "value"> & {
  showTrigger?: boolean
  showClear?: boolean
  value?: never
}) {
  const context = useComboboxContext("ComboboxInput")
  const isDisabled = disabled || context.disabled

  return (
    <InputGroup className={cn("w-auto", className)}>
      <InputGroupInput
        aria-activedescendant={
          context.open && !context.empty
            ? `${context.listId}-option-${context.activeIndex}`
            : undefined
        }
        aria-autocomplete="list"
        aria-controls={context.open ? context.listId : undefined}
        aria-expanded={context.open}
        aria-required={context.required || undefined}
        data-slot="combobox-input"
        disabled={isDisabled}
        id={props.id ?? context.inputId}
        role="combobox"
        value={context.inputValue}
        onBlur={onBlur}
        onChange={(event) => {
          onChange?.(event)
          context.setInputValue(event.currentTarget.value, event.nativeEvent)
          context.setOpen(true, event.nativeEvent, "input")
        }}
        onClick={(event) => {
          onClick?.(event)
          context.resetPlaceholderSelectionInput(event.nativeEvent)
          context.setOpen(true, event.nativeEvent, "input-click")
        }}
        onFocus={(event) => {
          onFocus?.(event)
          context.resetPlaceholderSelectionInput(event.nativeEvent)
          if (
            context.inputValue !== "" &&
            context.inputValue === context.selectedLabel
          ) {
            event.currentTarget.select()
          }
          context.setOpen(true, event.nativeEvent, "input-focus")
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event)

          if (event.defaultPrevented) {
            return
          }

          if (event.key === "ArrowDown") {
            event.preventDefault()
            context.setOpen(true, event.nativeEvent, "keyboard")
            context.setHighlightedIndex(
              Math.min(context.activeIndex + 1, context.filteredItems.length - 1)
            )
          } else if (event.key === "ArrowUp") {
            event.preventDefault()
            context.setOpen(true, event.nativeEvent, "keyboard")
            context.setHighlightedIndex(Math.max(context.activeIndex - 1, 0))
          } else if (event.key === "Enter" && context.open) {
            event.preventDefault()
            const item = context.filteredItems[context.activeIndex]

            if (item !== undefined) {
              context.selectItem(item, event.nativeEvent)
            }
          } else if (event.key === "Escape") {
            context.setOpen(false, event.nativeEvent, "escape-key")
          }
        }}
        {...props}
      />
      <InputGroupAddon align="inline-end">
        {showTrigger ? (
          <InputGroupButton
            size="icon-xs"
            variant="ghost"
            data-slot="input-group-button"
            className="group-has-data-[slot=combobox-clear]/input-group:hidden data-pressed:bg-transparent"
            disabled={isDisabled}
            onClick={(event) => {
              context.resetPlaceholderSelectionInput(event.nativeEvent)
              context.setOpen(!context.open, event.nativeEvent, "trigger-press")
            }}
          >
            <ChevronDownIcon className="pointer-events-none size-3.5 text-muted-foreground" />
          </InputGroupButton>
        ) : null}
        {showClear ? <ComboboxClear disabled={isDisabled} /> : null}
      </InputGroupAddon>
      {children}
    </InputGroup>
  )
}

function ComboboxContent({
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  align?: unknown
  alignOffset?: unknown
  anchor?: unknown
  side?: unknown
  sideOffset?: unknown
}) {
  const context = useComboboxContext("ComboboxContent")
  const [position, setPosition] = React.useState<React.CSSProperties | null>(null)

  React.useLayoutEffect(() => {
    if (!context.open) {
      return
    }

    function updatePosition() {
      const input = document.getElementById(context.inputId)
      const anchor = input?.closest<HTMLElement>("[data-slot=input-group]")

      if (!anchor) {
        return
      }

      const rect = anchor.getBoundingClientRect()

      setPosition({
        left: rect.left,
        minWidth: rect.width,
        top: rect.bottom + 4,
        width: rect.width,
      })
    }

    updatePosition()
    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)

    return () => {
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
    }
  }, [context.inputId, context.open])

  if (!context.open) {
    return null
  }

  const content = (
    <div
      data-slot="combobox-content"
      data-empty={context.empty ? true : undefined}
      ref={context.popupRef}
      style={position ?? undefined}
      className={cn(
        "pointer-events-auto fixed z-[70] rounded-none bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10",
        className
      )}
      onPointerDown={(event) => {
        event.stopPropagation()
      }}
      onWheel={(event) => {
        event.stopPropagation()
      }}
      {...props}
    >
      {children}
    </div>
  )

  return createPortal(content, document.body)
}

function ComboboxList({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  children?: React.ReactNode | ((item: any, index: number) => React.ReactNode)
}) {
  const context = useComboboxContext("ComboboxList")
  const renderedChildren =
    typeof children === "function"
      ? context.filteredItems.map((item, index) => children(item, index))
      : children

  return (
    <div
      data-empty={context.empty ? true : undefined}
      data-slot="combobox-list"
      id={context.listId}
      role="listbox"
      className={cn(
        "max-h-72 min-h-0 scroll-py-1.5 overflow-y-auto overscroll-contain p-1.5 data-empty:p-0",
        className
      )}
      {...props}
    >
      {renderedChildren}
    </div>
  )
}

function ComboboxItem({
  className,
  children,
  disabled = false,
  onClick,
  onMouseEnter,
  value,
  ...props
}: Omit<React.ComponentProps<"div">, "value"> & {
  disabled?: boolean
  value: unknown
}) {
  const context = useComboboxContext("ComboboxItem")
  const itemIndex = context.filteredItems.findIndex((item) => Object.is(item, value))
  const selected = context.isSelected(value)
  const highlighted = itemIndex === context.activeIndex

  return (
    <div
      aria-disabled={disabled || undefined}
      aria-selected={selected}
      data-disabled={disabled ? true : undefined}
      data-highlighted={highlighted ? true : undefined}
      data-selected={selected ? true : undefined}
      data-slot="combobox-item"
      id={itemIndex >= 0 ? `${context.listId}-option-${itemIndex}` : undefined}
      role="option"
      className={cn(
        "relative flex w-full cursor-default items-center gap-2.5 rounded-none py-2 pr-8 pl-3 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground not-data-[variant=destructive]:data-highlighted:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        className
      )}
      onClick={(event) => {
        onClick?.(event)

        if (!disabled) {
          context.selectItem(value, event.nativeEvent)
        }
      }}
      onMouseEnter={(event) => {
        onMouseEnter?.(event)

        if (!disabled && itemIndex >= 0) {
          context.setHighlightedIndex(itemIndex)
        }
      }}
      {...props}
    >
      {children}
      {selected ? (
        <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
          <CheckIcon className="pointer-events-none" />
        </span>
      ) : null}
    </div>
  )
}

function ComboboxGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="combobox-group" className={cn(className)} {...props} />
}

function ComboboxLabel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="combobox-label"
      className={cn(
        "px-3 py-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase",
        className
      )}
      {...props}
    />
  )
}

function ComboboxCollection({
  children,
}: {
  children: (item: any, index: number) => React.ReactNode
}) {
  const context = useComboboxContext("ComboboxCollection")

  return <>{context.filteredItems.map((item, index) => children(item, index))}</>
}

function ComboboxEmpty({ className, ...props }: React.ComponentProps<"div">) {
  const context = useComboboxContext("ComboboxEmpty")

  if (!context.empty) {
    return null
  }

  return (
    <div
      data-slot="combobox-empty"
      className={cn(
        "flex w-full justify-center py-2 text-center text-sm text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

function ComboboxSeparator({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="combobox-separator"
      className={cn("-mx-1.5 my-1.5 h-px bg-border/50", className)}
      {...props}
    />
  )
}

function ComboboxChips({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="combobox-chips"
      className={cn(
        "flex min-h-10 flex-wrap items-center gap-1.5 rounded-none border border-transparent border-b-input bg-transparent bg-clip-padding px-0 py-1.5 text-sm transition-[color,border-color] focus-within:border-b-ring has-aria-invalid:border-b-destructive has-data-[slot=combobox-chip]:px-0 dark:has-aria-invalid:border-b-destructive/50",
        className
      )}
      {...props}
    />
  )
}

function ComboboxChip({
  className,
  children,
  showRemove = true,
  ...props
}: React.ComponentProps<"div"> & {
  showRemove?: boolean
}) {
  return (
    <div
      data-slot="combobox-chip"
      className={cn(
        "flex h-[calc(--spacing(5.5))] w-fit items-center justify-center gap-1 rounded-none bg-muted px-2 text-xs font-medium whitespace-nowrap text-foreground has-disabled:pointer-events-none has-disabled:cursor-not-allowed has-disabled:opacity-50 has-data-[slot=combobox-chip-remove]:pr-0",
        className
      )}
      {...props}
    >
      {children}
      {showRemove ? (
        <Button
          variant="ghost"
          size="icon-xs"
          className="-ml-1 opacity-50 hover:opacity-100"
          data-slot="combobox-chip-remove"
        >
          <XIcon className="pointer-events-none" />
        </Button>
      ) : null}
    </div>
  )
}

function ComboboxChipsInput({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="combobox-chip-input"
      className={cn("min-w-16 flex-1 outline-none", className)}
      {...props}
    />
  )
}

function useComboboxAnchor() {
  return React.useRef<HTMLDivElement | null>(null)
}

export {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxGroup,
  ComboboxLabel,
  ComboboxCollection,
  ComboboxEmpty,
  ComboboxSeparator,
  ComboboxChips,
  ComboboxChip,
  ComboboxChipsInput,
  ComboboxTrigger,
  ComboboxValue,
  useComboboxAnchor,
}
