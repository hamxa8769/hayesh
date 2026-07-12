"use client"

import { Navbar } from "@/components/layout/Navbar"
import { AuroraField } from "@/components/three/AuroraField"
import { Hero } from "@/components/marketing/Hero"
import { StatStrip } from "@/components/marketing/StatStrip"
import { TeacherShowcase } from "@/components/marketing/TeacherShowcase"
import { SellerShowcase } from "@/components/marketing/SellerShowcase"
import { HowItWorks } from "@/components/marketing/HowItWorks"
import { CategoryStrip } from "@/components/marketing/CategoryStrip"
import { CtaBand } from "@/components/marketing/CtaBand"
import { LandingFooter } from "@/components/marketing/LandingFooter"

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <AuroraField />
      <Navbar />

      <Hero />
      <StatStrip />
      <TeacherShowcase />
      <SellerShowcase />
      <HowItWorks />
      <CategoryStrip />
      <CtaBand />
      <LandingFooter />
    </div>
  )
}
