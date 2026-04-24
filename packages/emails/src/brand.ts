export interface EmailBranding {
  appName: string
  companyName: string
  tagline: string
  supportEmail: string
  websiteUrl: string
}

export const defaultEmailBranding: EmailBranding = {
  appName: "Ink Wave Branding App",
  companyName: "Ink Wave Branding",
  tagline: "Operational updates for print orders, inventory, and invoice follow-through.",
  supportEmail: "support@inkwave.local",
  websiteUrl: "https://inkwave.local",
}
