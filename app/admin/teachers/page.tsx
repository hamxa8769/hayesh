"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { PanelGroup } from "@/components/dashboard/PanelGroup"
import { StatTile } from "@/components/dashboard/StatTile"
import { Reveal } from "@/components/motion/Reveal"
import { TeacherManagementTable, type TeacherWithProfile } from "@/components/admin/TeacherManagementTable"
import type { Profile, Teacher } from "@/types/database"

/**
 * Admin / Teachers — full teacher control surface: view, search, filter,
 * approve/reject, feature, suspend/activate accounts, edit profile fields.
 *
 * BUG FIX: the previous version ran `supabase.from('teachers').update({...})`
 * directly from the browser for approve/revoke. Migration 001 revoked UPDATE
 * on teachers.status from the `authenticated` role, so those writes now fail
 * with "permission denied" — and 'revoked' was never a valid
 * approval_status value to begin with (the enum is 'pending' | 'approved' |
 * 'rejected'; there is no 'suspended' teacher status either). Every write in
 * this surface now goes through PATCH /api/admin/users (service role,
 * admin-checked server-side) via TeacherAdminCard. "Suspend" is represented
 * as profiles.is_active = false, not a teacher status.
 */

export default function AdminTeachersPage() {
  const [rows, setRows] = useState<TeacherWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()

      const { data: teacherRows, error: teacherError } = await supabase
        .from("teachers")
        .select("*")
        .order("created_at", { ascending: false })
      if (teacherError) throw new Error(teacherError.message)
      const teachers = (teacherRows ?? []) as Teacher[]

      // Two queries instead of an embed: teachers.user_id -> profiles.id is a
      // many-to-one relationship, and supabase-js types an embedded profiles(...)
      // select as an array even though Postgres returns a single row — batching
      // a plain .in() lookup avoids that footgun entirely.
      const userIds = Array.from(new Set(teachers.map((t) => t.user_id)))
      const { data: profileRows, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .in("id", userIds.length > 0 ? userIds : [""])
      if (profileError) throw new Error(profileError.message)

      const profileMap = new Map<string, Profile>()
      for (const p of (profileRows ?? []) as Profile[]) profileMap.set(p.id, p)

      setRows(teachers.map((teacher) => ({ teacher, profile: profileMap.get(teacher.user_id) ?? null })))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load teachers")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleTeacherUpdated = useCallback((teacher: Teacher) => {
    setRows((prev) => prev.map((r) => (r.teacher.id === teacher.id ? { ...r, teacher } : r)))
  }, [])

  const handleProfileUpdated = useCallback((profile: Profile) => {
    setRows((prev) => prev.map((r) => (r.profile?.id === profile.id ? { ...r, profile } : r)))
  }, [])

  const stats = useMemo(() => {
    let pending = 0
    let approved = 0
    let suspended = 0
    for (const { teacher, profile } of rows) {
      const status = teacher.status ?? "pending"
      if (status === "pending") pending += 1
      if (status === "approved") approved += 1
      if (profile?.is_active === false) suspended += 1
    }
    return { total: rows.length, pending, approved, suspended }
  }, [rows])

  return (
    <div className="space-y-8">
      <Reveal>
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Admin / Teachers</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-text-primary sm:text-3xl">Teacher Management</h1>
        <p className="mt-1 text-sm text-text-muted">
          Review applications, control platform access, and manage teacher profiles.
        </p>
      </Reveal>

      <PanelGroup title="Teacher Metrics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Total teachers" value={stats.total} />
        <StatTile label="Pending approval" value={stats.pending} accent />
        <StatTile label="Approved" value={stats.approved} />
        <StatTile label="Suspended" value={stats.suspended} />
      </PanelGroup>

      <TeacherManagementTable
        rows={rows}
        loading={loading}
        error={error}
        onRetry={load}
        onTeacherUpdated={handleTeacherUpdated}
        onProfileUpdated={handleProfileUpdated}
      />
    </div>
  )
}
