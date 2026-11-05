import { useMemo, useState } from "react"
import { ListPlus, Pencil, Tag, Trash2 } from "lucide-react"
import { Page, PageHeader, Section, EmptyState } from "@/components/base/Page"
import { IconAction, PlayAllButton, ShuffleAllButton, TagAllButton } from "@/components/base/HeaderActions"
import { SongList } from "@/components/song/SongRow"
import { Modal } from "@/components/base/Modal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useLibraryStore } from "@/stores/useLibraryStore"
import { useUserStore } from "@/stores/useUserStore"
import { navigate } from "@/stores/useAppStore"
import { songsWithTag } from "@/lib/catalog"
import { addTagToSongs, deleteTag, renameTag } from "@/lib/actions"
import AddSongsDialog from "@/components/dialogs/AddSongsDialog"
import { errorMessage } from "@/lib/api"
import { formatDuration } from "@/utils/textUtils"
import type { QueueContext } from "@/player/queue"

/** All songs with a tag (your own or the file's genre) — play it as a mix. */
export default function TagPage({ tag }: { tag: string }) {
  const songs = useLibraryStore((s) => s.songs)
  const songTags = useUserStore((s) => s.songTags)
  const list = useMemo(() => songsWithTag(songs, tag, songTags), [songs, tag, songTags])
  const own = useMemo(() => Object.values(songTags).some((l) => l.some((t) => t.toLowerCase() === tag.toLowerCase())), [songTags, tag])
  const context = useMemo<QueueContext>(() => ({ type: "list", id: `tag:${tag.toLowerCase()}`, label: `${tag} mix` }), [tag])
  const [renaming, setRenaming] = useState(false)
  const [adding, setAdding] = useState(false)
  const listIds = useMemo(() => list.map((s) => s.id), [list])
  const [name, setName] = useState(tag)
  const [error, setError] = useState<string | null>(null)
  const total = list.reduce((a, s) => a + (s.metadata.duration || 0), 0)

  const doRename = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const t = await renameTag(tag, name)
      setRenaming(false)
      navigate({ name: "tag", tag: t }, { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  if (!list.length) return <EmptyState icon={Tag} title={`No songs tagged “${tag}”`} hint="Right-click any song and choose Tags… to add one." />
  return (
    <Page>
      <PageHeader
        eyebrow={own ? "Tag" : "Genre"}
        title={tag}
        icon={Tag}
        artwork={list.find((s) => s.metadata.thumbnail)?.metadata.thumbnail ?? null}
        colorKey={`tag:${tag.toLowerCase()}`}
        meta={<span>{list.length} songs · {formatDuration(total)}</span>}
        actions={
          <>
            <PlayAllButton songs={list} context={context} />
            <ShuffleAllButton songs={list} context={context} />
            <TagAllButton songs={list} />
            <IconAction icon={ListPlus} label={`Tag more songs “${tag}”`} onClick={() => setAdding(true)} />
            {own && <IconAction icon={Pencil} label="Rename tag" onClick={() => { setName(tag); setError(null); setRenaming(true) }} />}
            {own && <IconAction icon={Trash2} label="Remove this tag from all songs" onClick={async () => (await deleteTag(tag)) && navigate({ name: "library", tab: "tags" }, { replace: true })} />}
          </>
        }
      />
      <Section>
        <SongList songs={list} queueContext={context} />
      </Section>
      <AddSongsDialog open={adding} onOpenChange={setAdding} title={`Tag songs “${tag}”`} description="Pick songs from your library to tag." excludeIds={listIds} onAdd={(ids) => addTagToSongs(ids, tag)} />
      <Modal
        open={renaming}
        onClose={() => setRenaming(false)}
        size="sm"
      title="Rename tag"
        description="Renaming to an existing tag merges them."
        onSubmit={doRename}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setRenaming(false)}>Cancel</Button>
            <Button type="submit" disabled={!name.trim()}>Rename</Button>
          </>
        }
      >
        <Input autoFocus value={name} maxLength={32} onChange={(e) => { setName(e.target.value); setError(null) }} aria-label="Tag name" aria-invalid={Boolean(error)} />
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </Modal>
    </Page>
  )
}
