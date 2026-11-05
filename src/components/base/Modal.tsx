import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { DIALOG_LARGE } from "./dialogSize"

type Props = {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  description?: React.ReactNode
  footer?: React.ReactNode
  children?: React.ReactNode
  /** Everything is one large size, whose body scrolls. "sm" is only for quick confirmations. */
  size?: "sm" | "large"
  /** Wrap content in a <form> so Enter submits. */
  onSubmit?: (e: React.FormEvent) => void
}


/** Standard dialog: title, optional description, body and footer actions. */
export function Modal({ open, onClose, title, description, footer, children, size = "large", onSubmit }: Props) {
  const large = size === "large"
  const body = (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description ? <DialogDescription>{description}</DialogDescription> : <DialogDescription className="sr-only">{typeof title === "string" ? title : "Dialog"}</DialogDescription>}
      </DialogHeader>
      {large ? <div className="min-h-0 flex-1 overflow-y-auto pr-1">{children}</div> : children}
      {footer && <DialogFooter>{footer}</DialogFooter>}
    </>
  )
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={large ? DIALOG_LARGE : "sm:max-w-md"}>
        {onSubmit ? (
          <form onSubmit={onSubmit} className={cn("flex flex-col gap-4", large && "min-h-0 flex-1")}>
            {body}
          </form>
        ) : (
          body
        )}
      </DialogContent>
    </Dialog>
  )
}
