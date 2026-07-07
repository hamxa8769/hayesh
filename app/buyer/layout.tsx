import { DashboardLayoutShell } from "@/components/layout/DashboardLayoutShell"
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardLayoutShell role="buyer" title="My Account" allowedRoles={["buyer", "admin"]}>{children}</DashboardLayoutShell>
}
