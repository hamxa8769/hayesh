"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { CardCover } from "@/components/cards/CardCover"
import { cn } from "@/lib/utils/cn"

interface GigGalleryProps {
  title: string
  category: string
  images: string[]
}

export function GigGallery({ title, category, images }: GigGalleryProps) {
  const [index, setIndex] = useState(0)

  if (images.length === 0) {
    return (
      <div className="overflow-hidden rounded-lg border border-border">
        <CardCover category={category} imageUrl={null} className="border-b-0">
          <span className="absolute left-4 top-4 rounded-full border border-line-strong bg-background/80 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted backdrop-blur">
            {category}
          </span>
        </CardCover>
      </div>
    )
  }

  const count = images.length
  const go = (next: number) => setIndex((next + count) % count)

  return (
    <div className="flex flex-col gap-3">
      <div className="group/gallery relative aspect-[16/10] w-full overflow-hidden rounded-lg border border-border bg-surface-elevated">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={images[index]}
          src={images[index]}
          alt={`${title} preview ${index + 1} of ${count}`}
          className="h-full w-full object-cover"
          fetchPriority={index === 0 ? "high" : "auto"}
        />
        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label="Previous image"
              className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-line-strong bg-background/80 text-text-primary backdrop-blur transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/60"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label="Next image"
              className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-line-strong bg-background/80 text-text-primary backdrop-blur transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/60"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="absolute bottom-3 right-3 rounded-full border border-line-strong bg-background/80 px-2.5 py-0.5 font-mono text-[11px] tabular-nums text-text-muted backdrop-blur">
              {index + 1} / {count}
            </span>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Gallery thumbnails">
          {images.map((url, i) => (
            <button
              key={url}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Show image ${i + 1}`}
              onClick={() => setIndex(i)}
              className={cn(
                "relative aspect-[16/10] w-24 shrink-0 overflow-hidden rounded-md border transition-[border-color,opacity] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/60 sm:w-28",
                i === index ? "border-accent-primary" : "border-border opacity-70 hover:opacity-100"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
