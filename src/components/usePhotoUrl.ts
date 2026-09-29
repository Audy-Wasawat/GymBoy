import { useEffect, useState } from 'react'

/** Object URL for a stored photo Blob, revoked when the blob changes or the component unmounts. */
export function usePhotoUrl(blob?: Blob | null) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!blob) { setUrl(undefined); return }
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}
