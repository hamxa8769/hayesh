"use client"

import { DashboardLayoutShell } from "@/components/layout/DashboardLayoutShell"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayoutShell
      role="admin"
      title="Admin Dashboard"
      allowedRoles={["admin"]}
    >
      {children}
    </DashboardLayoutShell>
  )
}
