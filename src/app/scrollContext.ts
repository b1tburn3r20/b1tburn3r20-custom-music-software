import { createContext, useContext } from "react"

/** The main content scroll container (Radix ScrollArea viewport), for virtualized lists. */
export const ScrollParentContext = createContext<HTMLElement | null>(null)
export const useScrollParent = () => useContext(ScrollParentContext)
