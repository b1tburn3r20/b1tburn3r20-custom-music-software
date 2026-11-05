import { Modal } from "@/components/base/Modal"
import { useDialogStore } from "@/stores/useDialogStore"
import { SHORTCUTS } from "@/app/shortcuts"

function Keys({ keys }: { keys: string[] }) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      {keys.map((k) => (
        <kbd key={k} className="min-w-6 rounded border border-border bg-muted px-1.5 py-0.5 text-center font-mono text-xs text-foreground">
          {k}
        </kbd>
      ))}
    </span>
  )
}

/** Ctrl+/ (or ?) — every keyboard shortcut in one place. */
export default function ShortcutsDialog() {
  const open = useDialogStore((s) => s.shortcutsOpen)
  const close = () => useDialogStore.getState().openShortcuts(false)
  return (
    <Modal open={open} onClose={close} title="Keyboard shortcuts" description="Everything in the app works from the keyboard. Shortcuts pause while you type in a text field. Ctrl+/ or Esc closes this.">
      <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
        {SHORTCUTS.map((g) => (
          <section key={g.title} aria-label={g.title}>
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{g.title}</h3>
            <dl className="flex flex-col gap-1.5">
              {g.items.map((it) => (
                <div key={it.label} className="flex items-center justify-between gap-4 text-sm">
                  <dt className="min-w-0">{it.label}</dt>
                  <dd>
                    <Keys keys={it.keys} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Modal>
  )
}
