import { useDirectoryStore } from "@/stores/useDirectoryStore"

export const DebugComponent = () => {
  const dirData = useDirectoryStore((f) => f.dirData)

  const safeStringify = (obj: any) => {
    const seen = new WeakSet()
    return JSON.stringify(obj, (k: any, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) return '[Circular]'
        seen.add(value)
      }
      return value
    }, 2)
  }

  return (
    <div className="p-4 bg-black/50 text-white overflow-auto max-h-96">
      <pre className="text-xs">
        {(() => {
          try {
            return safeStringify(dirData)
          } catch (error) {
            return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        })()}
      </pre>
    </div>
  )
}
