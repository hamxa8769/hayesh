"use client"

import { motion } from "framer-motion"
import { GraduationCap, Search, Filter, Star, ArrowRight } from "lucide-react"
import { Navbar } from "@/components/layout/Navbar"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { JarvisButton } from "@/components/ui/jarvis-button"
import { JarvisInput } from "@/components/ui/jarvis-input"
import { Badge } from "@/components/ui/badge"

const placeholderTeachers = [
  {
    id: "1",
    name: "Dr. Ayesha Khan",
    subjects: ["Mathematics", "Physics"],
    rating: 4.9,
    reviews: 127,
    pricePKR: 5000,
    tagline: "PhD in Applied Mathematics | 10+ years teaching",
    translation: true,
  },
  {
    id: "2",
    name: "Prof. Hassan Ali",
    subjects: ["English Literature", "Creative Writing"],
    rating: 4.8,
    reviews: 89,
    pricePKR: 4000,
    tagline: "Published author | IELTS specialist",
    translation: false,
  },
  {
    id: "3",
    name: "Sarah Malik",
    subjects: ["Computer Science", "Web Development"],
    rating: 4.7,
    reviews: 203,
    pricePKR: 6000,
    tagline: "Full-stack developer | Ex-Google",
    translation: true,
  },
]

export default function TeachersPage() {
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
              Find Your Perfect Teacher
            </h1>
            <p className="mt-2 text-text-muted">
              Browse verified tutors across Mathematics, Science, Languages, and more.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8 flex flex-col sm:flex-row gap-3"
          >
            <div className="flex-1">
              <JarvisInput placeholder="Search by subject, name, or keyword..." icon={<Search className="h-4 w-4" />} />
            </div>
            <JarvisButton variant="secondary" size="default">
              <Filter className="h-4 w-4" />
              Filters
            </JarvisButton>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {placeholderTeachers.map((teacher, i) => (
              <motion.div
                key={teacher.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.1 }}
              >
                <JarvisCard glow="violet" className="p-6 h-full flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-primary/10">
                      <GraduationCap className="h-6 w-6 text-accent-primary" />
                    </div>
                    {teacher.translation && (
                      <Badge variant="cyan">✦ Multilingual</Badge>
                    )}
                  </div>

                  <h3 className="font-display text-lg font-semibold text-text-primary">
                    {teacher.name}
                  </h3>
                  <p className="text-sm text-text-muted mt-1">{teacher.tagline}</p>

                  <div className="flex flex-wrap gap-2 mt-3">
                    {teacher.subjects.map((s) => (
                      <Badge key={s} variant="secondary">{s}</Badge>
                    ))}
                  </div>

                  <div className="mt-auto pt-4 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Star className="h-4 w-4 fill-accent-warning text-accent-warning" />
                      <span className="text-sm font-medium text-text-primary">{teacher.rating}</span>
                      <span className="text-xs text-text-muted">({teacher.reviews})</span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-text-muted">from</p>
                      <p className="font-mono text-lg font-bold text-accent-primary">
                        ₨{teacher.pricePKR.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <JarvisButton variant="secondary" size="sm" className="w-full mt-4">
                    View Profile
                    <ArrowRight className="h-3.5 w-3.5" />
                  </JarvisButton>
                </JarvisCard>
              </motion.div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
