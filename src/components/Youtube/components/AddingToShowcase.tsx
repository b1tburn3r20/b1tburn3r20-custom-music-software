"use client"
import { useDirectoryStore } from "@/stores/useDirectoryStore"
const AddingToShowcase = () => {
  const activeFolder = useDirectoryStore((f) => f.currentDir)

  return (
    <div className="bg-accent flex gap-1 items-center w-fit p-2 rounded-2xl text-xl">
      {activeFolder ? (
        <>
          <span>Currently saving music to playlist:</span>
          <div className="p-2 rounded-3xl">
            <span className="text-primary font-semibold">
              {activeFolder?.name}
            </span>
          </div>
        </>
      ) : (
        <>
          <span className="text-md mx-2">Select a <span className="p-1 rounded-3xl px-2 bg-primary">playlist</span> to save music</span>
        </>
      )
      }
    </div>
  )
}

export default AddingToShowcase
