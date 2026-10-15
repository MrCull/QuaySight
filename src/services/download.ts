// Saves text as a file through a Blob and an object URL. No network: the file is built in memory.
// The object URL is revoked after the click has been handed to the browser.

/** Delay before revoking, so browsers that start the download asynchronously still have the URL. */
export const REVOKE_DELAY_MS = 1000

export function downloadText(filename: string, text: string, mimeType: string): void {
  const blob = new Blob([text], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS)
}
