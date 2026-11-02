import { Label } from "@/components/ui/label"
import { useId } from "react"

/** One labelled setting: title + hint on the left, control on the right. */
export function SettingRow({ label, hint, children }: { label: string; hint?: string; children: (id: string) => React.ReactNode }) {
  const id = useId()
  return (
    <div className="flex items-center justify-between gap-6 py-3">
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="shrink-0">{children(id)}</div>
    </div>
  )
}
