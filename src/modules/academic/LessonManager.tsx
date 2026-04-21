'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase, type Group, type Post } from '@/lib/supabase'
import toast from 'react-hot-toast'

export function LessonManager() {
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  
  const [formData, setFormData] = useState({
    title: '',
    content: '',
  })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadOrganizationData()
  }, [])

  useEffect(() => {
    if (selectedGroup) {
      loadPosts(selectedGroup.id)
    }
  }, [selectedGroup])

  async function loadOrganizationData() {
    const { data: { user: supabaseUser } } = await supabase.auth.getUser()
    if (!supabaseUser) return

    setUserId(supabaseUser.id)
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', supabaseUser.id)
      .single()

    if (profile?.organization_id) {
      loadGroups(profile.organization_id)
    } else {
      setLoading(false)
    }
  }

  async function loadGroups(orgId: string) {
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setGroups(data as Group[])
    }
    setLoading(false)
  }

  async function loadPosts(groupId: string) {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setPosts(data as Post[])
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation']
      if (!allowedTypes.includes(file.type)) {
        toast.error('Tipo de archivo no permitido. Solo PDF y documentos Word/PowerPoint')
        return
      }
      setSelectedFile(file)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedGroup || !formData.title || !userId) return

    setUploading(true)
    try {
      let fileUrl = null
      let fileName = null
      let fileType = null

      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop()
        const filePath = `${selectedGroup.id}/${Date.now()}.${fileExt}`
        
        const { error: uploadError } = await supabase.storage
          .from('post-files')
          .upload(filePath, selectedFile)

        if (uploadError) {
          toast.error('Error al subir archivo: ' + uploadError.message)
          setUploading(false)
          return
        }

        const { data: urlData } = supabase.storage
          .from('post-files')
          .getPublicUrl(filePath)

        fileUrl = urlData.publicUrl
        fileName = selectedFile.name
        fileType = selectedFile.type
      }

      const { error } = await supabase.from('posts').insert({
        title: formData.title,
        content: formData.content || null,
        file_url: fileUrl,
        file_name: fileName,
        file_type: fileType,
        group_id: selectedGroup.id,
        author_id: userId,
      })

      if (error) {
        toast.error('Error al guardar: ' + error.message)
      } else {
        toast.success('Lección creada con éxito')
        setShowModal(false)
        setFormData({ title: '', content: '' })
        setSelectedFile(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        loadPosts(selectedGroup.id)
      }
    } catch (error) {
      toast.error('Error al conectar con el servidor')
    }
    setUploading(false)
  }

  async function deletePost(postId: string) {
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId)

    if (!error && selectedGroup) {
      toast.success('Lección eliminada')
      loadPosts(selectedGroup.id)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Lecciones</h1>
          <p className="text-sm text-slate-500">Crea y gestiona materiales para tus grupos</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          disabled={!selectedGroup}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva Lección
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-slate-200 p-4 sticky top-4">
            <h2 className="text-sm font-medium text-slate-700 mb-3">Seleccionar Grupo</h2>
            {loading ? (
              <div className="animate-pulse h-10 bg-slate-100 rounded-lg" />
            ) : (
              <select
                value={selectedGroup?.id || ''}
                onChange={(e) => {
                  const group = groups.find(g => g.id === e.target.value)
                  setSelectedGroup(group || null)
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
              >
                <option value="">Seleccionar grupo...</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h2 className="text-sm font-medium text-slate-700 mb-3">
              Materiales {selectedGroup ? `- ${selectedGroup.name}` : ''}
            </h2>

            {!selectedGroup ? (
              <p className="text-sm text-slate-500 text-center py-8">
                Selecciona un grupo para ver los materiales
              </p>
            ) : posts.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">
                No hay materiales en este grupo
              </p>
            ) : (
              <div className="space-y-3">
                {posts.map((post) => (
                  <div
                    key={post.id}
                    className="flex items-start justify-between p-4 bg-slate-50 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-slate-900">{post.title}</h3>
                      {post.content && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{post.content}</p>
                      )}
                      {post.file_name && (
                        <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span>{post.file_name}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {post.file_url && (
                        <a
                          href={post.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-primary-600 hover:bg-primary-50 rounded"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </a>
                      )}
                      <button
                        onClick={() => deletePost(post.id)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Nueva Lección</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Título</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Título de la lección"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Descripción (opcional)"
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Archivo</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.ppt,.pptx"
                  onChange={handleFileSelect}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                />
                <p className="text-xs text-slate-500 mt-1">PDF, Word o PowerPoint</p>
              </div>

              {selectedFile && (
                <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                  <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-sm text-slate-700 truncate">{selectedFile.name}</span>
                </div>
              )}

              {uploading && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Subiendo archivo...
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploading || !formData.title}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Subiendo...
                    </>
                  ) : (
                    'Guardar'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}