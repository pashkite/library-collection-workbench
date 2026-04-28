export function getAladinKey() {
  return localStorage.getItem('aladin-ttb-key') ?? ''
}

export function setAladinKey(value: string) {
  localStorage.setItem('aladin-ttb-key', value.trim())
}

export async function getStorageEstimate() {
  if (!navigator.storage?.estimate) return undefined
  return navigator.storage.estimate()
}
