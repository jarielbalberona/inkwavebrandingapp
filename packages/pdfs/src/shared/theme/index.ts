export interface PdfSpacingScale {
  xs: number
  sm: number
  md: number
  lg: number
  xl: number
  xxl: number
}

export interface PdfTypographyScale {
  caption: number
  body: number
  label: number
  title: number
}

export interface PdfPalette {
  text: string
  mutedText: string
  border: string
  panel: string
  accent: string
  accentSoft: string
  success: string
  danger: string
}

export const pdfSpacing: PdfSpacingScale = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
}

export const pdfTypography: PdfTypographyScale = {
  caption: 8,
  body: 10,
  label: 9,
  title: 22,
}

export const pdfPalette: PdfPalette = {
  text: "#111827",
  mutedText: "#6b7280",
  border: "#d1d5db",
  panel: "#f9fafb",
  accent: "#1f2937",
  accentSoft: "#e5e7eb",
  success: "#166534",
  danger: "#991b1b",
}
