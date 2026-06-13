/**
 * storage.ts — student file uploads (Phase 5 of the Azure migration).
 *
 * Two backends behind FEATURE_FLAGS.AZURE_STORAGE:
 *
 *   false → Firebase Storage (uploadBytes + getDownloadURL), original behavior.
 *   true  → Azure Blob Storage. The client asks the Functions app
 *           (/api/uploadSas) for a pair of SAS URLs: a short-lived write URL
 *           for the exact blob path, and a long-lived read URL that gets
 *           stored on the submission (equivalent trust model to Firebase's
 *           tokened download URLs — unguessable, no account keys in the
 *           browser). The storage account itself stays private; no public
 *           blob access is enabled.
 *
 * Both backends return the URL to store in the submission's data.url field.
 */
import { AZURE_STORAGE } from '../config/featureFlags'

const API_BASE = import.meta.env.VITE_SIGNALR_URL || '/api'

export async function uploadFile(path: string, file: File | Blob): Promise<string> {
  return AZURE_STORAGE ? uploadToBlob(path, file) : uploadToFirebase(path, file)
}

async function uploadToFirebase(path: string, file: File | Blob): Promise<string> {
  const { ref: storageRef, uploadBytes, getDownloadURL } = await import('firebase/storage')
  const { storage } = await import('../firebase')
  const fileRef = storageRef(storage, path)
  await uploadBytes(fileRef, file)
  return getDownloadURL(fileRef)
}

async function uploadToBlob(path: string, file: File | Blob): Promise<string> {
  const contentType = (file as File).type || 'application/octet-stream'

  const sasRes = await fetch(`${API_BASE}/uploadSas`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
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
