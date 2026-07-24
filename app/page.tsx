"use client"

import { Navbar } from "@/components/layout/Navbar"
import { ScrollWorld } from "@/components/three/ScrollWorld"
import { Hero } from "@/components/marketing/Hero"
import { StatStrip } from "@/components/marketing/StatStrip"
import { TeacherShowcase } from "@/components/marketing/TeacherShowcase"
import { SellerShowcase } from "@/components/marketing/SellerShowcase"
import { AIStudioSection } from "@/components/marketing/AIStudioSection"
import { PricingModel } from "@/components/marketing/PricingModel"
import { HowItWorks } from "@/components/marketing/HowItWorks"
import { CategoryStrip } from "@/components/marketing/CategoryStrip"
import { CtaBand } from "@/components/marketing/CtaBand"
import { LandingFooter } from "@/components/marketing/LandingFooter"

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Exactly one WebGL canvas for the whole page — ScrollWorld replaces
          the old static AuroraField hero shader with a single scroll-driven
          particle field that runs behind every section below. */}
      <ScrollWorld />
      <Navbar />

      <Hero />
      <StatStrip />
      <TeacherShowcase />
      <SellerShowcase />
      <AIStudioSection />
      <PricingModel />
      <HowItWorks />
      <CategoryStrip />
      <CtaBand />
      <LandingFooter />
    </div>
  )
}
