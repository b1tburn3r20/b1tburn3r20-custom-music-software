// A menu described as data, rendered either as a right-click ContextMenu or a
// "⋯" DropdownMenu, so both always show exactly the same actions.
import type { LucideIcon } from "lucide-react"
import {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuLabel,
} from "@/components/ui/context-menu"
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { Check } from "lucide-react"

export type MenuEntry =
  | { kind: "item"; key: string; label: string; icon?: LucideIcon; onSelect: () => void; destructive?: boolean; disabled?: boolean; checked?: boolean }
  | { kind: "separator"; key: string }
  | { kind: "label"; key: string; label: string }
  | { kind: "sub"; key: string; label: string; icon?: LucideIcon; children: MenuEntry[] }

const KITS = {
  context: { Item: ContextMenuItem, Sep: ContextMenuSeparator, Sub: ContextMenuSub, SubTrigger: ContextMenuSubTrigger, SubContent: ContextMenuSubContent, Label: ContextMenuLabel },
  dropdown: { Item: DropdownMenuItem, Sep: DropdownMenuSeparator, Sub: DropdownMenuSub, SubTrigger: DropdownMenuSubTrigger, SubContent: DropdownMenuSubContent, Label: DropdownMenuLabel },
}

export function MenuEntries({ entries, kind }: { entries: MenuEntry[]; kind: keyof typeof KITS }) {
  const K = KITS[kind]
  return (
    <>
      {entries.map((e) => {
        if (e.kind === "separator") return <K.Sep key={e.key} />
        if (e.kind === "label") return <K.Label key={e.key} className="text-xs text-muted-foreground">{e.label}</K.Label>
        if (e.kind === "sub") {
          const Icon = e.icon
          return (
            <K.Sub key={e.key}>
              <K.SubTrigger className="gap-2">
                {Icon && <Icon className="size-4 text-muted-foreground" />}
                {e.label}
              </K.SubTrigger>
              <K.SubContent className="max-h-80 overflow-y-auto min-w-48">
                <MenuEntries entries={e.children} kind={kind} />
              </K.SubContent>
            </K.Sub>
          )
        }
        const Icon = e.icon
        return (
          <K.Item key={e.key} variant={e.destructive ? "destructive" : "default"} disabled={e.disabled} onSelect={() => e.onSelect()} className="gap-2">
            {Icon && <Icon className="size-4" />}
            <span className="flex-1 truncate">{e.label}</span>
            {e.checked && <Check className="size-4 text-primary" aria-label="already added" />}
          </K.Item>
        )
      })}
    </>
  )
}
