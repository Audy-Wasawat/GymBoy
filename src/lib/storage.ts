export type PersistState = 'persisted' | 'not-persisted' | 'unsupported'

/** Asks the browser to keep this app's data even when the device is low on space. */
export async function requestPersistence(): Promise<PersistState> {
  if (!navigator.storage?.persist) return 'unsupported'
  try {
    if (await navigator.storage.persisted()) return 'persisted'
    return (await navigator.storage.persist()) ? 'persisted' : 'not-persisted'
  } catch {
    return 'unsupported'
  }
}

export async function checkPersistence(): Promise<PersistState> {
  if (!navigator.storage?.persisted) return 'unsupported'
  try {
    return (await navigator.storage.persisted()) ? 'persisted' : 'not-persisted'
  } catch {
    return 'unsupported'
  }
}

export async function storageUsageMB(): Promise<number | undefined> {
  if (!navigator.storage?.estimate) return undefined
  try {
    const { usage } = await navigator.storage.estimate()
    return usage === undefined ? undefined : Math.round((usage / 1024 / 1024) * 10) / 10
  } catch {
    return undefined
  }
}

/** True when running from the home screen rather than a browser tab. */
export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true
