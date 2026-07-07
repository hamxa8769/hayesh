"use client"

import { motion } from "framer-motion"
import { ShoppingBag, Star, ArrowRight, Clock, Check } from "lucide-react"
import { Navbar } from "@/components/layout/Navbar"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { JarvisButton } from "@/components/ui/jarvis-button"
import { JarvisInput } from "@/components/ui/jarvis-input"
import { Badge } from "@/components/ui/badge"
import { Search, Filter } from "lucide-react"

const placeholderGigs = [
  {
    id: "1",
    title: "I will design a modern logo for your brand",
    seller: "Creative Studio",
    rating: 4.9,
    reviews: 342,
    pricePKR: 2500,
    delivery: "3 days",
    category: "Design",
    level: "top" as const,
  },
  {
    id: "2",
    title: "I will edit your YouTube videos professionally",
    seller: "Media Pro",
    rating: 4.7,
    reviews: 156,
    pricePKR: 5000,
    delivery: "5 days",
    category: "Video",
    level: "rising" as const,
  },
  {
    id: "3",
    title: "I will build a responsive website with React",
    seller: "Dev Agency",
    rating: 4.8,
    reviews: 89,
    pricePKR: 15000,
    delivery: "7 days",
    category: "Programming",
    level: "elite" as const,
  },
]

const levelColors: Record<string, "default" | "cyan" | "success" | "warning"> = {
  new: "default",
  rising: "cyan",
  top: "success",
  elite: "warning",
}

export default function MarketplacePage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-24 pb-16 px-6">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="font-display text-3xl font-bold text-text-primary sm:text-4xl">
              Marketplace
            </h1>
            <p className="mt-2 text-text-muted">
              Hire talented freelancers for design, video, writing, programming, and more.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8 flex flex-col sm:flex-row gap-3"
          >
            <div className="flex-1">
              <JarvisInput placeholder="Search gigs..." icon={<Search className="h-4 w-4" />} />
            </div>
            <JarvisButton variant="secondary" size="default">
              <Filter className="h-4 w-4" />
              Filters
            </JarvisButton>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {placeholderGigs.map((gig, i) => (
              <motion.div
                key={gig.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.1 }}
              >
                <JarvisCard glow="cyan" className="p-6 h-full flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <Badge variant="secondary">{gig.category}</Badge>
                    <Badge variant={levelColors[gig.level]}>{gig.level}</Badge>
                  </div>

                  <h3 className="font-display text-lg font-semibold text-text-primary">
                    {gig.title}
                  </h3>
                  <p className="text-sm text-text-muted mt-1">by {gig.seller}</p>

                  <div className="mt-auto pt-4 space-y-3">
                    <div className="flex items-center gap-4 text-sm text-text-muted">
                      <div className="flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-accent-warning text-accent-warning" />
                        <span className="text-text-primary font-medium">{gig.rating}</span>
                        <span>({gig.reviews})</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {gig.delivery}
                      </div>
                    </div>

                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-xs text-text-muted">Starting at</p>
                        <p className="font-mono text-xl font-bold text-accent-secondary">
                          ₨{gig.pricePKR.toLocaleString()}
                        </p>
                      </div>
                      <JarvisButton variant="primary" size="sm">
                        View Gig
                        <ArrowRight className="h-3.5 w-3.5" />
                      </JarvisButton>
                    </div>
                  </div>
                </JarvisCard>
              </motion.div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
