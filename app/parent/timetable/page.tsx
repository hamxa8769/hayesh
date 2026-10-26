"use client"

import { PastClasses } from "@/components/classes/PastClasses"
import { UpcomingClasses } from "@/components/classes/UpcomingClasses"

export default function ParentTimetablePage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-text-primary">Timetable</h2>
        <p className="mt-1 text-sm text-text-muted">Your child&apos;s upcoming classes. The Join button opens 10 minutes before the start.</p>
      </div>
      <UpcomingClasses />
      <PastClasses viewer="parent" />
    </div>
  )
}
