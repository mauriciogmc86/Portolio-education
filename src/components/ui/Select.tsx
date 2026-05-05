import * as React from "react"

interface SelectProps {
  value: string
  onValueChange: (value: string) => void
  children: React.ReactNode
  placeholder?: string
  className?: string
}

export function Select({ value, onValueChange, children, placeholder = 'Seleccionar...', className = '' }: SelectProps) {
  const [open, setOpen] = React.useState(false)
  const buttonRef = React.useRef<HTMLButtonElement>(null)

  const childrenArray = React.Children.toArray(children) as React.ReactElement<SelectItemProps>[]

  const selectedOption = childrenArray.find(child => child.props.value === value)

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-left focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm flex items-center justify-between"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={value ? 'text-slate-900' : 'text-slate-400'}>
          {selectedOption ? selectedOption.props.children : placeholder}
        </span>
        <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto">
            <div className="py-1" role="listbox">
              {childrenArray.map((child) => {
                const optionValue = child.props.value
                const isSelected = optionValue === value
                return (
                  <div
                    key={optionValue}
                    className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                    onClick={() => {
                      onValueChange(optionValue)
                      setOpen(false)
                    }}
                    role="option"
                    aria-selected={isSelected}
                  >
                    {child.props.children}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

interface SelectItemProps {
  value: string
  children: React.ReactNode
}

export function SelectItem({ value, children }: SelectItemProps) {
  return null
}

Select.displayName = 'Select'
