import { TeacherProfileEditor } from "@/components/teacher/TeacherProfileEditor"

/**
 * Teacher profile settings. All the editing logic — loading the teachers row,
 * the "finish onboarding first" prompt for teachers with no row yet, the
 * per-section saves, and the encrypted withdrawal-account editor — lives in
 * TeacherProfileEditor so this route stays a thin shell.
 */
export default function TeacherProfilePage() {
  return <TeacherProfileEditor />
}
