/**
 * storage.ts — student file uploads via Azure Blob Storage (Phase 5+).
 *
 * The client requests a pair of SAS URLs from the Functions app
 * (/api/uploadSas): a short-lived write URL for the exact blob path, and a
 * long-lived read URL stored on the submission (same unguessable-URL trust
 * model as Firebase's tokened download URLs). The storage account stays
 * private — no public blob access.
 */
import { authHeaders } from './sessionAuth'

const API_BASE = import.meta.env.VITE_SIGNALR_URL || '/api'

export async function uploadFile(path: string, file: File | Blob): Promise<string> {
  const contentType = (file as File).type || 'application/octet-stream'

  const sasRes = await fetch(`${API_BASE}/uploadSas`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ path, contentType }),
  })
  if (!sasRes.ok) throw new Error(`uploadSas failed: ${sasRes.status}`)
  const { uploadUrl, readUrl } = await sasRes.json()

  const put = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'x-ms-blob-type': 'BlockBlob', 'content-type': contentType },
    body: file,
  })
  if (!put.ok) throw new Error(`Blob upload failed: ${put.status}`)

  return readUrl
}
