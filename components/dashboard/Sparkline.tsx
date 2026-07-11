export interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  className?: string
}

const JADE = "var(--color-jade)"
const GOLD = "var(--color-gold)"

export function Sparkline({ data, width = 88, height = 32, className }: SparklineProps) {
  const viewBox = `0 0 ${width} ${height}`

  if (!data || data.length === 0) {
    return <svg width={width} height={height} viewBox={viewBox} className={className} aria-hidden="true" />
  }

  if (data.length === 1) {
    const cy = height / 2
    return (
      <svg width={width} height={height} viewBox={viewBox} preserveAspectRatio="none" className={className} aria-hidden="true">
        <line x1={0} y1={cy} x2={width} y2={cy} stroke={JADE} strokeOpacity={0.3} strokeWidth={1.5} />
        <circle cx={width - 2} cy={cy} r={2.5} fill={GOLD} />
      </svg>
    )
  }

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const stepX = width / (data.length - 1)

  const points = data.map((value, index) => {
    const x = index * stepX
    const y = height - ((value - min) / range) * height
    return { x, y }
  })

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ")
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`
  const last = points[points.length - 1]

  return (
    <svg width={width} height={height} viewBox={viewBox} preserveAspectRatio="none" className={className} aria-hidden="true">
      <path d={areaPath} fill={JADE} fillOpacity={0.14} stroke="none" />
      <path d={linePath} fill="none" stroke={JADE} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last.x} cy={last.y} r={2.5} fill={GOLD} />
    </svg>
  )
}
