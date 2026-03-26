const PT_LOWERCASE = new Set(['de', 'do', 'da', 'dos', 'das', 'e', 'em', 'com', 'a', 'o', 'no', 'na'])

export function toTitleCase(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .split(' ')
    .map((w, i) => (i === 0 || !PT_LOWERCASE.has(w)) ? w.charAt(0).toUpperCase() + w.slice(1) : w)
    .join(' ')
}

export async function fetchCodigoIbge(municipio: string, uf: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    let res: Response
    try {
      res = await fetch(`https://brasilapi.com.br/api/ibge/municipios/v1/${uf}`, {
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
    }
    if (!res.ok) return null
    const list: { nome: string; codigo_ibge: string }[] = await res.json()
    const norm = (s: string) =>
      s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim()
    const found = list.find(m => norm(m.nome) === norm(municipio))
    return found?.codigo_ibge ?? null
  } catch {
    return null
  }
}
