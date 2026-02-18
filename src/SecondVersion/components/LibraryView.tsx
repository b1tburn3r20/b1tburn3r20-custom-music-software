import { useAppStore } from "@/stores/useAppStore"

const LibraryView = () => {
  const view = useAppStore((f) => f.view)

  if (view !== "library") {
    return null
  }

  return (
    <div>Library</div>
  )
}

export default LibraryView
