import { DashboardLayoutShell } from "@/components/layout/DashboardLayoutShell"
import { MfaBanner } from "@/components/admin/MfaBanner"
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayoutShell role="admin" title="Admin Panel" allowedRoles={["admin"]}>
      <MfaBanner />
      {children}
    </DashboardLayoutShell>
  )
}
