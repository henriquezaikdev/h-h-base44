import { motion } from 'framer-motion'
import { Boxes } from 'lucide-react'
import type { CriticalProduct } from '../../hooks/useGestorData'

export function GestorEstoqueCritico({ products }: { products: CriticalProduct[] }) {
  if (products.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.4 }}
      className="bg-white rounded-xl border border-red-200"
    >
      <div className="px-6 py-4 border-b border-red-100 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center">
          <Boxes size={14} className="text-red-500" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-red-700">Estoque Crítico</h3>
          <p className="text-[10px] text-red-400">{products.length} produtos abaixo do mínimo</p>
        </div>
      </div>
      <div className="divide-y divide-red-50">
        {products.map(p => (
          <div key={p.id} className="px-6 py-2.5 flex items-center gap-3 hover:bg-red-50/30 transition-colors">
            <span className="text-sm text-[#111827] flex-1 truncate">{p.name}</span>
            <div className="flex items-center gap-4 shrink-0">
              <div className="text-right">
                <span className="text-[10px] text-[#9CA3AF]">Atual</span>
                <p className="text-sm font-semibold text-red-600 tabular-nums">{p.stock_qty}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-[#9CA3AF]">Mín</span>
                <p className="text-sm font-medium text-[#6B7280] tabular-nums">{p.stock_min}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
