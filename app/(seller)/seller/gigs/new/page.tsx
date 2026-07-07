"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Save, ArrowRight } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { JarvisInput } from "@/components/ui/jarvis-input"
import { JarvisButton } from "@/components/ui/jarvis-button"
import { useSupabase } from "@/hooks/useSupabase"

export default function NewGigPage() {
  const { user } = useSupabase()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    title: "",
    category: "",
    description: "",
    basic_title: "Basic",
    basic_description: "",
    basic_price_pkr: "",
    basic_delivery_days: "3",
    standard_title: "Standard",
    standard_description: "",
    standard_price_pkr: "",
    standard_delivery_days: "5",
    premium_title: "Premium",
    premium_description: "",
    premium_price_pkr: "",
    premium_delivery_days: "7",
  })

  const update = (field: string, value: string) => setForm({ ...form, [field]: value })

  const handleSubmit = async () => {
    if (!user) return
    setSaving(true)
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()

    const { data: seller } = await supabase.from("sellers").select("id").eq("user_id", user.id).single()
    if (!seller) { setSaving(false); return }

    const { error } = await supabase.from("gigs").insert({
      seller_id: seller.id,
      title: form.title,
      category: form.category,
      description: form.description,
      basic_title: form.basic_title,
      basic_description: form.basic_description,
      basic_price_pkr: parseInt(form.basic_price_pkr) || 0,
      basic_delivery_days: parseInt(form.basic_delivery_days) || 3,
      standard_title: form.standard_title,
      standard_description: form.standard_description,
      standard_price_pkr: parseInt(form.standard_price_pkr) || 0,
      standard_delivery_days: parseInt(form.standard_delivery_days) || 5,
      premium_title: form.premium_title,
      premium_description: form.premium_description,
      premium_price_pkr: parseInt(form.premium_price_pkr) || 0,
      premium_delivery_days: parseInt(form.premium_delivery_days) || 7,
    })

    setSaving(false)
    if (!error) router.push("/gigs")
  }

  const steps = ["Title & Category", "Description", "Basic Package", "Standard Package", "Premium Package"]

  return (
    <div className="space-y-6 max-w-2xl">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-display font-bold text-text-primary">Create New Gig</h2>
      </motion.div>

      {/* Progress */}
      <div className="flex gap-1">
        {steps.map((s, i) => (
          <div key={s} className={`h-1 flex-1 rounded-full ${i < step ? "bg-accent-primary" : "bg-surface-elevated"}`} />
        ))}
      </div>

      <JarvisCard glow="violet" className="p-6 space-y-4">
        {step === 1 && (
          <>
            <JarvisInput label="Gig Title" value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="I will design a modern logo..." />
            <JarvisInput label="Category" value={form.category} onChange={(e) => update("category", e.target.value)} placeholder="Design, Video, Writing, Programming..." />
          </>
        )}
        {step === 2 && (
          <JarvisInput label="Description" value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="Describe your service in detail..." />
        )}
        {step === 3 && (
          <>
            <p className="text-sm font-medium text-accent-primary">Basic Package</p>
            <JarvisInput label="Package Name" value={form.basic_title} onChange={(e) => update("basic_title", e.target.value)} />
            <JarvisInput label="Description" value={form.basic_description} onChange={(e) => update("basic_description", e.target.value)} />
            <JarvisInput label="Price (PKR)" type="number" value={form.basic_price_pkr} onChange={(e) => update("basic_price_pkr", e.target.value)} />
            <JarvisInput label="Delivery Days" type="number" value={form.basic_delivery_days} onChange={(e) => update("basic_delivery_days", e.target.value)} />
          </>
        )}
        {step === 4 && (
          <>
            <p className="text-sm font-medium text-accent-secondary">Standard Package</p>
            <JarvisInput label="Package Name" value={form.standard_title} onChange={(e) => update("standard_title", e.target.value)} />
            <JarvisInput label="Description" value={form.standard_description} onChange={(e) => update("standard_description", e.target.value)} />
            <JarvisInput label="Price (PKR)" type="number" value={form.standard_price_pkr} onChange={(e) => update("standard_price_pkr", e.target.value)} />
            <JarvisInput label="Delivery Days" type="number" value={form.standard_delivery_days} onChange={(e) => update("standard_delivery_days", e.target.value)} />
          </>
        )}
        {step === 5 && (
          <>
            <p className="text-sm font-medium text-accent-success">Premium Package</p>
            <JarvisInput label="Package Name" value={form.premium_title} onChange={(e) => update("premium_title", e.target.value)} />
            <JarvisInput label="Description" value={form.premium_description} onChange={(e) => update("premium_description", e.target.value)} />
            <JarvisInput label="Price (PKR)" type="number" value={form.premium_price_pkr} onChange={(e) => update("premium_price_pkr", e.target.value)} />
            <JarvisInput label="Delivery Days" type="number" value={form.premium_delivery_days} onChange={(e) => update("premium_delivery_days", e.target.value)} />
          </>
        )}

        <div className="flex justify-between pt-4">
          {step > 1 && (
            <JarvisButton variant="ghost" onClick={() => setStep(step - 1)}>Back</JarvisButton>
          )}
          {step < 5 ? (
            <JarvisButton variant="primary" onClick={() => setStep(step + 1)} className="ml-auto">
              Next <ArrowRight className="h-4 w-4" />
            </JarvisButton>
          ) : (
            <JarvisButton variant="primary" onClick={handleSubmit} loading={saving} className="ml-auto">
              <Save className="h-4 w-4" /> Publish Gig
            </JarvisButton>
          )}
        </div>
      </JarvisCard>
    </div>
  )
}
