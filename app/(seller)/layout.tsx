"use client"

import { DashboardLayoutShell } from "@/components/layout/DashboardLayoutShell"

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayoutShell
      role="seller"
      title="Seller Portal"
      allowedRoles={["seller", "admin"]}
    >
      {children}
    </DashboardLayoutShell>
  )
}
