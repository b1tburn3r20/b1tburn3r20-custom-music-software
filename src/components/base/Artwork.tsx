import { cn } from "@/lib/utils"
import { Music } from "lucide-react"
import { useState } from "react"

const SIZES = {
  xs: "size-6 rounded-sm",
  sm: "size-10 rounded-md",
  md: "size-14 rounded-md",
  lg: "size-48 rounded-lg",
  xl: "size-[min(60vh,600px)] rounded-sm",
  fill: "w-full aspect-square rounded-lg",
} as const

/** Album/song artwork with a consistent fallback when there is no image (or it fails to load). */
export function Artwork({ src, size = "sm", alt = "", className }: { src: string | null | undefined; size?: keyof typeof SIZES; alt?: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  const show = src && !failed
  return (
    <div className={cn("relative shrink-0 overflow-hidden bg-muted", SIZES[size], className)}>
      {show ? (
        <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} className="size-full object-cover" />
      ) : (
        <div className="size-full flex items-center justify-center text-muted-foreground">
          <Music className="size-1/2 max-w-12 max-h-12" aria-hidden />
        </div>
      )}
    </div>
  )
}
