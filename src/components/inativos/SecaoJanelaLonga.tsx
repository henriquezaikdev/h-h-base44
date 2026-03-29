import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Moon, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ClienteJanela } from '../../hooks/useClientesInativos'

const fmtCnpj = (v: string | null) => { if (!v) return ''; const d = v.replace(/\D/g, ''); return d.length === 14 ? `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}` : v }
const fmtDate = (d: string | null) => { if (!d) return '—'; return new Date(String(d).replace(' ', 'T')).toLocaleDateString('pt-BR') }

export function SecaoJanelaLonga({ clientes }: { clientes: ClienteJanela[] }) {
  const [open, setOpen] = useState(false)
  const nav = useNavigate()

  if (clientes.length === 0) return null

  return (
    <div>
      <button onClick={() => setOpen(p => !p)}
        className="flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#374151] transition-colors mb-3 group">
        <Moon size={14} className="text-[#9CA3AF] group-hover:text-[#6B7280]" />
        <span className="font-medium">Silêncio programado</span>
        <span className="text-[10px] bg-[#F3F4F6] text-[#9CA3AF] px-2 py-0.5 rounded-full tabular-nums">{clientes.length}</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <p className="text-xs text-[#9CA3AF] mb-3 ml-6">
              Clientes que compram com intervalo longo mas sempre retornam.
            </p>
            <div className="bg-white rounded-xl border border-[#E5E7EB] divide-y divide-[#F3F4F6]">
              {clientes.map(c => {
                const janelaAberta = c.proxima_compra_estimada ? new Date(c.proxima_compra_estimada) < new Date() : false
                return (
                  <div key={c.id} className="px-5 py-3 flex items-center justify-between hover:bg-[#FAFAF9] transition-colors">
                    <div>
                      <button onClick={() => nav(`/clientes/${c.id}`)}
                        className="text-sm font-medium text-[#111827] hover:text-[#3B5BDB] transition-colors">
                        {c.name}
                      </button>
                      <p className="text-xs text-[#9CA3AF] mt-0.5">
                        {c.sellers?.name ?? '—'}{c.cnpj ? ` · ${fmtCnpj(c.cnpj)}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-xs shrink-0">
                      <div className="text-right text-[#6B7280]">
                        <p>Compra a cada <span className="font-semibold tabular-nums">~{c.intervalo_medio_dias ?? '—'}d</span></p>
                        <p className="text-[#9CA3AF]">Próxima: {fmtDate(c.proxima_compra_estimada)}</p>
                      </div>
                      {janelaAberta && (
                        <span className="flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-lg whitespace-nowrap">
                          <AlertTriangle size={10} /> Janela aberta
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
