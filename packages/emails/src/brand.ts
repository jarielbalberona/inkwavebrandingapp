export interface EmailBranding {
  appName: string
  companyName: string
  tagline: string
  supportEmail: string
  websiteUrl: string
  /** Absolute URL for the header mark (`<Img src>`; email clients need a public https URL). */
  headerLogoUrl: string
}

export const defaultEmailBranding: EmailBranding = {
  appName: "Ink Wave Branding App",
  companyName: "Ink Wave Branding",
  tagline: "Operational updates for print orders, inventory, and invoice follow-through.",
  supportEmail: "support@inkwave.local",
  websiteUrl: "https://inkwave.local",
  headerLogoUrl: "https://assets.inkwavebrand.ing/iw-logo.jpg",
}
