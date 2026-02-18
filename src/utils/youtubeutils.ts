import { useYoutubeStore } from "@/components/Youtube/useYoutubeStore"

/**
 * Generates optional query parameters for YouTube API searches based on active filters
 * @returns URL query parameter string to append to search requests
 */
export const getOptionalQueryParams = (): string => {
  const officialFilter = useYoutubeStore.getState().officialFilter
  const safeSearch = useYoutubeStore.getState().safeSearch
  const musicCategoryOnly = useYoutubeStore.getState().musicCategoryOnly
  const playlistMode = useYoutubeStore.getState().playlists
  const params: string[] = []

  // Add channel filter if official filter is enabled
  if (officialFilter) {
    params.push(`channelId=UCBR8-60-B28hp2BmDPdntcQ`)
  }
  if (safeSearch) {
    params.push(`safeSearch=true`)
  } else {
    params.push(`safeSearch=none`)
  }
  if (musicCategoryOnly && !playlistMode) {
    params.push(`videoCategoryId=10`)
  }


  // Join all params with & and prepend with & if there are any params
  return params.length > 0 ? `&${params.join('&')}` : ''
}
