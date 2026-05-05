'use client'

import * as React from 'react'

interface TabsProps {
  defaultValue: string
  value?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
  className?: string
}

interface TabsContextType {
  value: string
  onValueChange: (value: string) => void
}

const TabsContext = React.createContext<TabsContextType | undefined>(undefined)

export function Tabs({ defaultValue, value, onValueChange, children, className = '' }: TabsProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue)
  const currentValue = value !== undefined ? value : internalValue

  const handleValueChange = (newValue: string) => {
    if (value === undefined) {
      setInternalValue(newValue)
    }
    onValueChange?.(newValue)
  }

  return (
    <TabsContext.Provider value={{ value: currentValue, onValueChange: handleValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

export function useTabs() {
  const context = React.useContext(TabsContext)
  if (!context) {
    throw new Error('Tabs components must be used within a Tabs provider')
  }
  return context
}

interface TabsListProps {
  children: React.ReactNode
  className?: string
}

export function TabsList({ children, className = '' }: TabsListProps) {
  return (
    <div className={`inline-flex items-center justify-center rounded-lg bg-slate-100 p-1 ${className}`}>
      {children}
    </div>
  )
}

interface TabsTriggerProps {
  value: string
  children: React.ReactNode
  className?: string
}

export function TabsTrigger({ value, children, className = '' }: TabsTriggerProps) {
  const { value: activeValue, onValueChange } = useTabs()
  const isActive = value === activeValue

  return (
    <button
      type="button"
      onClick={() => onValueChange(value)}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
        isActive
          ? 'bg-white text-slate-900 shadow-sm'
          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
      } ${className}`}
    >
      {children}
    </button>
  )
}

interface TabsContentProps {
  value: string
  children: React.ReactNode
  className?: string
}

export function TabsContent({ value, children, className = '' }: TabsContentProps) {
  const { value: activeValue } = useTabs()
  if (value !== activeValue) return null
  return <div className={className}>{children}</div>
}

TabsList.displayName = 'TabsList'
TabsTrigger.displayName = 'TabsTrigger'
TabsContent.displayName = 'TabsContent'
