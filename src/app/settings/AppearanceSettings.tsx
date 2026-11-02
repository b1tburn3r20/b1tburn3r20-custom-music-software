import { Check } from "lucide-react"
import { THEMES, applyTheme } from "@/app/theme"
import { updateSettings } from "@/lib/actions"
import { useUserStore } from "@/stores/useUserStore"
import { cn } from "@/lib/utils"

/** Theme picker. Each preview is rendered *in* its theme via data-theme, so the swatches are real tokens. */
export default function AppearanceSettings() {
  const current = useUserStore((s) => s.settings.theme)
  const choose = (id: string) => {
    applyTheme(id) // instant; persisted below
    void updateSettings({ theme: id })
  }
  return (
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-2 gap-4">
      {THEMES.map((t) => {
        const selected = (current || "dark") === t.id
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => choose(t.id)}
            data-theme={t.id}
            data-mode={t.mode}
            className={cn("relative flex flex-col gap-3 rounded-xl border-2 bg-background p-3 text-left text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", selected ? "border-primary" : "border-border hover:border-muted-foreground")}
          >
            <div className="flex h-16 gap-2 overflow-hidden rounded-lg bg-card p-2" aria-hidden>
              <div className="w-6 rounded bg-muted" />
              <div className="flex flex-1 flex-col gap-1.5">
                <div className="h-2 w-3/4 rounded bg-foreground/80" />
                <div className="h-2 w-1/2 rounded bg-muted-foreground/60" />
                <div className="mt-auto flex gap-1">
                  <span className="size-3 rounded-full bg-primary" />
                  <span className="size-3 rounded-full bg-like" />
                  <span className="size-3 rounded-full bg-chart-2" />
                  <span className="size-3 rounded-full bg-chart-3" />
                </div>
              </div>
            </div>
            <div>
              <p className="font-semibold">{t.label}</p>
              <p className="text-xs text-muted-foreground">{t.description}</p>
            </div>
            {selected && <Check className="absolute right-3 top-3 size-5 text-primary" aria-hidden />}
          </button>
        )
      })}
    </div>
  )
}
