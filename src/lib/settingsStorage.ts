const env = import.meta.env as unknown as Record<string, string | undefined>
const ENV_ALADIN_KEY = (env.ALADIN_TTB_KEY ?? env.VITE_ALADIN_TTB_KEY ?? '').trim()

export function getAladinKey() {
  return localStorage.getItem('aladin-ttb-key') ?? ENV_ALADIN_KEY
}

export function setAladinKey(value: string) {
  const nextValue = value.trim()
  if (nextValue) {
    localStorage.setItem('aladin-ttb-key', nextValue)
    return
  }
  localStorage.removeItem('aladin-ttb-key')
}

export async function getStorageEstimate() {
  if (!navigator.storage?.estimate) return undefined
  return navigator.storage.estimate()
}
