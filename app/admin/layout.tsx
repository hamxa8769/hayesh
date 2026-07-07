import { DashboardLayoutShell } from "@/components/layout/DashboardLayoutShell"
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardLayoutShell role="admin" title="Admin Panel" allowedRoles={["admin"]}>{children}</DashboardLayoutShell>
}
