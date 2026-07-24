"use client"

import { Navbar } from "@/components/layout/Navbar"
import { HeroIsland } from "@/components/marketing/HeroIsland"
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
      {/* Exactly one WebGL canvas for the whole page — the voxel showcase
          island inside HeroIsland. It replaces the old ScrollWorld particle
          field as the landing page's single, signature 3D moment; every
          section below is quiet obsidian. */}
      <Navbar />

      <HeroIsland />
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
