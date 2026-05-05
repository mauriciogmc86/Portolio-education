import { type Profile } from '@/lib/supabase'

type UserRole = 'coordinators' | 'teachers' | 'students'

interface UserTableProps {
  users: Profile[]
  onEdit: (user: Profile) => void
  getRoleBadgeClass: (role: string) => string
  getRoleLabel: (role: string) => string
  activeTab: UserRole
}

export function UserTable({ users, onEdit, getRoleBadgeClass, getRoleLabel, activeTab }: UserTableProps) {
  if (users.length === 0) {
    return (
      <div className="px-6 py-8 text-center text-slate-500">
        No hay usuarios en esta categoría
      </div>
    )
  }

  return (
    <table className="w-full">
      <thead className="bg-slate-50 border-b border-slate-200">
        <tr>
          <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Nombre</th>
          <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Email</th>
          <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Rol</th>
          <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Fecha de registro</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-200">
        {users.map((user) => (
          <tr
            key={user.id}
            className="hover:bg-slate-50 cursor-pointer"
            onClick={() => onEdit(user)}
          >
            <td className="px-6 py-4 text-sm text-slate-900 font-medium">{user.full_name || '-'}</td>
            <td className="px-6 py-4 text-sm text-slate-600">{user.email}</td>
            <td className="px-6 py-4">
              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeClass(user.role)}`}>
                {getRoleLabel(user.role)}
              </span>
            </td>
            <td className="px-6 py-4 text-sm text-slate-500">
              {new Date(user.created_at).toLocaleDateString('es-ES')}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
