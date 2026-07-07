"use client"

import { motion } from "framer-motion"
import { Cpu, Zap, ArrowRight, Star } from "lucide-react"
import { Navbar } from "@/components/layout/Navbar"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { JarvisButton } from "@/components/ui/jarvis-button"
import { JarvisInput } from "@/components/ui/jarvis-input"
import { Badge } from "@/components/ui/badge"
import { Search } from "lucide-react"

const placeholderServices = [
  {
    id: "1",
    title: "AI Content Writer",
    description: "Generate blog posts, articles, and marketing copy in any tone and language.",
    pricePKR: 500,
    instant: true,
    rating: 4.8,
    orders: 1240,
    category: "Writing",
  },
  {
    id: "2",
    title: "Code Review Assistant",
    description: "Get expert-level code reviews with improvement suggestions and bug detection.",
    pricePKR: 800,
    instant: true,
    rating: 4.9,
    orders: 890,
    category: "Programming",
  },
  {
    id: "3",
    title: "Logo Design AI",
    description: "AI-generated logo concepts based on your brand brief and preferences.",
    pricePKR: 300,
    instant: true,
    rating: 4.6,
    orders: 2100,
    category: "Design",
  },
]

export default function AIServicesPage() {
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
            <div className="flex items-center gap-3 mb-2">
              <Badge variant="success">✦ HayeshAI Studio</Badge>
            </div>
            <h1 className="font-display text-3xl font-bold text-text-primary sm:text-4xl">
              AI Services
            </h1>
            <p className="mt-2 text-text-muted">
              Instant AI-powered delivery. No human seller needed — AI fulfills your order in seconds.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <JarvisInput placeholder="Search AI services..." icon={<Search className="h-4 w-4" />} />
          </motion.div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {placeholderServices.map((service, i) => (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.1 }}
              >
                <JarvisCard glow="green" className="p-6 h-full flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent-success/10">
                      <Cpu className="h-6 w-6 text-accent-success" />
                    </div>
                    {service.instant && (
                      <Badge variant="success">
                        <Zap className="h-3 w-3 mr-1" />
                        Instant
                      </Badge>
                    )}
                  </div>

                  <h3 className="font-display text-lg font-semibold text-text-primary">
                    {service.title}
                  </h3>
                  <p className="text-sm text-text-muted mt-1">{service.description}</p>

                  <div className="mt-auto pt-4 space-y-3">
                    <div className="flex items-center gap-4 text-sm text-text-muted">
                      <div className="flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-accent-warning text-accent-warning" />
                        <span className="text-text-primary font-medium">{service.rating}</span>
                      </div>
                      <span>{service.orders.toLocaleString()} orders</span>
                    </div>

                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-xs text-text-muted">Starting at</p>
                        <p className="font-mono text-xl font-bold text-accent-success">
                          ₨{service.pricePKR.toLocaleString()}
                        </p>
                      </div>
                      <JarvisButton variant="primary" size="sm">
                        Try Now
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
