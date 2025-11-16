import type { TreeItem } from "@/types/DirectoryTypes"
import Playlist from "./Playlist"

interface RenderTreeItemProps {
  treeItem: TreeItem
}
const RenderTreeItem = ({ treeItem }: RenderTreeItemProps) => {
  const isDir = treeItem?.isDirectory
  const hasChildren = !!treeItem?.children?.length


  const RenderSelf = () => {
    if (isDir) {
      return (
        <Playlist hasChildren={hasChildren} folder={treeItem as Directory} />
      )
    }
  }
  return (
    <div className="pl-2">
      <RenderSelf />
    </div>
  )
}

export default RenderTreeItem
