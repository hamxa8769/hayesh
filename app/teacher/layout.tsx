import { DashboardLayoutShell } from "@/components/layout/DashboardLayoutShell"
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardLayoutShell role="teacher" title="Teacher Portal" allowedRoles={["teacher", "admin"]}>{children}</DashboardLayoutShell>
}
