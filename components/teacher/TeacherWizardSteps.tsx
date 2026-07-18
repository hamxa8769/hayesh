import { Check } from "lucide-react"
import { cn } from "@/lib/utils/cn"

export interface TeacherWizardStepsProps {
  steps: readonly string[]
  currentStep: number
}

export function TeacherWizardSteps({ steps, currentStep }: TeacherWizardStepsProps) {
  return (
    <ol className="flex items-center gap-1.5 overflow-x-auto sm:gap-4">
      {steps.map((label, index) => {
        const stepNumber = index + 1
        const isComplete = stepNumber < currentStep
        const isActive = stepNumber === currentStep

        return (
          <li key={label} className="flex flex-1 shrink-0 items-center gap-1.5 last:flex-none sm:gap-4">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold transition-colors duration-300",
                  isComplete && "aurora-bg text-[#08090C]",
                  isActive && !isComplete && "border border-accent-primary text-accent-primary",
                  !isActive && !isComplete && "border border-border text-text-muted"
                )}
              >
                {isComplete ? <Check className="h-4 w-4" /> : stepNumber}
              </span>
              <span
                className={cn(
                  "hidden font-mono text-[11px] uppercase tracking-[0.1em] sm:inline",
                  isActive ? "text-text-primary" : "text-text-muted"
                )}
              >
                {label}
              </span>
            </div>
            {stepNumber < steps.length && (
              <span aria-hidden="true" className={cn("h-px flex-1", isComplete ? "aurora-bg" : "bg-border")} />
            )}
          </li>
        )
      })}
    </ol>
  )
}
