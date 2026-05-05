import React, { useState, useMemo } from 'react'

type Option = { value: string; label: string }

export default function SearchableMultiSelect({
  options = [],
  value = [],
  onChange,
  placeholder,
}: {
  options?: Option[]
  value?: string[]
  onChange: (vals: string[]) => void
  placeholder?: string
}) {
  const [query, setQuery] = useState('')
  const safeOptions = options || []
  const safeValue = value || []

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return safeOptions
    return safeOptions.filter(o => o.label.toLowerCase().includes(q))
  }, [safeOptions, query])

  function toggle(v: string) {
    if (safeValue.includes(v)) onChange(safeValue.filter(x => x !== v))
    else onChange([...safeValue, v])
  }

  return (
    <div className="border rounded p-2">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder || 'Buscar...'}
        className="w-full px-2 py-1 text-sm outline-none"
      />
      <div className="max-h-40 overflow-auto mt-2">
        {filtered.map(opt => (
          <label key={opt.value} className="flex items-center gap-2 py-1 px-1 hover:bg-slate-50 rounded">
            <input
              type="checkbox"
              checked={safeValue.includes(opt.value)}
              onChange={() => toggle(opt.value)}
            />
            <span className="text-sm">{opt.label}</span>
          </label>
        ))}
        {filtered.length === 0 && <p className="text-xs text-slate-400 p-2">No hay resultados</p>}
      </div>
    </div>
  )
}
