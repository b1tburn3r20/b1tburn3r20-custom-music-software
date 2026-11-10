/** How close the cursor has to be to the bar to grow it, in px: generous above, where the page is, and only a sliver below, where the player's buttons are. */
export const SEEK_REACH_ABOVE = 40
export const SEEK_REACH_BELOW = 2

/** Whether a cursor at y is near enough a bar spanning top..bottom to grow it. */
export const nearSeekBar = (y: number, top: number, bottom: number) => y >= top - SEEK_REACH_ABOVE && y <= bottom + SEEK_REACH_BELOW
