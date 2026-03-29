import { LayoutList, Zap } from 'lucide-react'

type Mode = 'normal' | 'interativo'

export function ViewModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[#F3F4F6]">
      {(['normal', 'interativo'] as Mode[]).map(m => (
        <button key={m} onClick={() => onChange(m)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            mode === m ? 'bg-white text-[#111827] shadow-sm' : 'text-[#6B7280] hover:text-[#374151]'
          }`}>
          {m === 'normal' ? <LayoutList size={12} /> : <Zap size={12} />}
          {m === 'normal' ? 'Normal' : 'Interativo'}
        </button>
      ))}
    </div>
  )
}
