
export const findFolderByPath = (tree: any[], path: string): any => {
  for (const item of tree) {
    if (item.path === path) {
      return item
    }
    if (item.children) {
      const found = findFolderByPath(item.children, path)
      if (found) return found
    }
  }

  return null
}


