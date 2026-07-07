import { DashboardLayoutShell } from "@/components/layout/DashboardLayoutShell"
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardLayoutShell role="parent" title="Parent Portal" allowedRoles={["parent", "admin"]}>{children}</DashboardLayoutShell>
}
