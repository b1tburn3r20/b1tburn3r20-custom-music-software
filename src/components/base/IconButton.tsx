import { forwardRef } from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  icon: LucideIcon
  /** Accessible name; also used as the tooltip. */
  label: string
  size?: "sm" | "md" | "lg"
  /** Highlights the icon (toggle on, e.g. shuffle/repeat). */
  active?: boolean
  iconClassName?: string
}

const SIZES = { sm: "p-2 [&_svg]:size-4", md: "p-3 [&_svg]:size-5", lg: "p-4 [&_svg]:size-6" }

/** Round icon-only button used by the player, toolbars and headers. */
export const IconButton = forwardRef<HTMLButtonElement, Props>(function IconButton({ icon: Icon, label, size = "lg", active, className, iconClassName, ...rest }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full outline-none transition-colors duration-fast",
        "text-foreground hover:bg-accent/40 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40",
        SIZES[size],
        className,
      )}
      {...rest}
    >
      <Icon className={cn(active === true && "text-primary", active === false && "text-muted-foreground", iconClassName)} aria-hidden />
    </button>
  )
})
