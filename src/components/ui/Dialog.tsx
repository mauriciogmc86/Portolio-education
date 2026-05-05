import * as React from "react"

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  title?: string
  description?: string
}

export function Dialog({ open, onOpenChange, children, title, description }: DialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        {title && (
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            {description && (
              <p className="text-sm text-slate-500 mt-1">{description}</p>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

interface DialogFooterProps {
  children: React.ReactNode
  className?: string
}

export function DialogFooter({ children, className = '' }: DialogFooterProps) {
  return (
    <div className={`flex gap-3 pt-4 mt-4 border-t border-slate-200 ${className}`}>
      {children}
    </div>
  )
}

interface DialogHeaderProps {
  children: React.ReactNode
  className?: string
}

export function DialogHeader({ children, className = '' }: DialogHeaderProps) {
  return <div className={`mb-4 ${className}`}>{children}</div>
}

export function DialogTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <h2 className={`text-lg font-semibold text-slate-900 ${className}`}>{children}</h2>
}

export function DialogDescription({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-sm text-slate-500 mt-1 ${className}`}>{children}</p>
}

Dialog.displayName = 'Dialog'
DialogFooter.displayName = 'DialogFooter'
DialogHeader.displayName = 'DialogHeader'
