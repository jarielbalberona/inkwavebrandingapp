const MANILA_TIMEZONE = "Asia/Manila"
const MANILA_UTC_OFFSET_SUFFIX = "+08:00"
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000

const manilaDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: MANILA_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

const manilaLabelFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: MANILA_TIMEZONE,
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long",
})

const manilaWeekdayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: MANILA_TIMEZONE,
  weekday: "short",
})

export interface DailyDigestBusinessWindow {
  businessDate: string
  timezone: typeof MANILA_TIMEZONE
  startedAt: Date
  endedAt: Date
}

export function getManilaBusinessDate(value: Date = new Date()): string {
  return manilaDateFormatter.format(value)
}

export function getManilaBusinessWindow(businessDate: string): DailyDigestBusinessWindow {
  const startedAt = new Date(`${businessDate}T00:00:00${MANILA_UTC_OFFSET_SUFFIX}`)
  const endedAt = new Date(startedAt.getTime() + DAY_IN_MILLISECONDS)

  return {
    businessDate,
    timezone: MANILA_TIMEZONE,
    startedAt,
    endedAt,
  }
}

export function formatManilaBusinessDateLabel(businessDate: string): string {
  return manilaLabelFormatter.format(new Date(`${businessDate}T12:00:00${MANILA_UTC_OFFSET_SUFFIX}`))
}

export function isManilaWeekday(businessDate: string): boolean {
  const weekday = manilaWeekdayFormatter.format(
    new Date(`${businessDate}T12:00:00${MANILA_UTC_OFFSET_SUFFIX}`),
  )

  return weekday !== "Sat" && weekday !== "Sun"
}
