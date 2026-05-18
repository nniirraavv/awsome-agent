import { useEffect, useState } from 'react'

const API = import.meta.env.VITE_API_HTTP_URL ?? ''

export function useTenantServices() {
  const [detectedServices, setDetectedServices] = useState<string[]>([])
  const [activeMcpServers, setActiveMcpServers] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/tenant/services`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then((data: { detectedServices: string[]; activeMcpServers: string[] } | null) => {
        if (data) {
          setDetectedServices(data.detectedServices)
          setActiveMcpServers(data.activeMcpServers)
        }
      })
      .catch(() => { /* ignore */ })
      .finally(() => setLoading(false))
  }, [])

  return { detectedServices, activeMcpServers, loading }
}
