import { cn } from '@/lib/utils/cn'

export interface AvatarProps {
  /** Participant display name (or identity) — initials are derived from this. */
  name: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: 'h-9 w-9 text-xs',
  md: 'h-14 w-14 text-lg sm:h-16 sm:w-16 sm:text-xl',
  lg: 'h-20 w-20 text-2xl sm:h-28 sm:w-28 sm:text-4xl',
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : (parts[0]?.[1] ?? '')
  return `${first}${last}`.toUpperCase()
}

/** Camera-off / no-track placeholder: initials in an aurora-gradient circle,
 *  centered on the tile's bg-surface-elevated — never a blank box. */
export function Avatar({ name, size = 'md', className }: AvatarProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'aurora-bg flex shrink-0 select-none items-center justify-center rounded-full font-display font-semibold text-background shadow-[0_4px_20px_rgba(0,0,0,0.35)]',
        SIZE_CLASSES[size],
        className
      )}
    >
      {getInitials(name)}
    </div>
  )
}
