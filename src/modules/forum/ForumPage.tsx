'use client'

import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, type ForumTopic, type ForumPost, type Group } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import toast from 'react-hot-toast'
import {
  getForumTopic,
  getForumPostsByTopic,
  createForumTopic,
  createForumPost,
  togglePinTopic,
  toggleLockTopic,
} from '@/services/forumService'

export function ForumPage() {
  const { topicId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [topics, setTopics] = useState<ForumTopic[]>([])
  const [selectedTopic, setSelectedTopic] = useState<ForumTopic | null>(null)
  const [posts, setPosts] = useState<ForumPost[]>([])
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [newPostContent, setNewPostContent] = useState('')
  const [showNewTopic, setShowNewTopic] = useState(false)
  const [newTopicTitle, setNewTopicTitle] = useState('')
  const [newTopicContent, setNewTopicContent] = useState('')
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')

  const isTeacher = user?.profile?.role === 'teacher' || user?.profile?.role === 'admin' || user?.profile?.role === 'super_admin'

  useEffect(() => {
    if (showNewTopic && isTeacher && groups.length === 0) {
      loadGroups()
    }
  }, [showNewTopic, isTeacher, groups.length])

  useEffect(() => {
    loadData()
    if (isTeacher && groups.length === 0) {
      loadGroups()
    }
  }, [user, topicId])

  async function loadGroups() {
    if (!user?.profile?.organization_id) return

    const { data } = await supabase
      .from('groups')
      .select('*')
      .eq('organization_id', user.profile.organization_id)

    if (data) {
      setGroups(data)
      if (data.length > 0) {
        setSelectedGroupId(data[0].id)
      }
    }
  }

  async function loadData() {
    if (!user) return

    setLoading(true)
    try {
      if (topicId) {
        const [topicData, postsData] = await Promise.all([
          getForumTopic(topicId),
          getForumPostsByTopic(topicId),
        ])

        setSelectedTopic(topicData)
        setPosts(postsData)
      } else {
        if (isTeacher && selectedGroupId) {
          const { data } = await supabase
            .from('forums')
            .select('*')
            .eq('group_id', selectedGroupId)
            .order('created_at', { ascending: false })

          setTopics(data || [])
        } else {
          const { data } = await supabase
            .from('forums')
            .select('*')
            .eq('organization_id', user.profile?.organization_id)
            .order('created_at', { ascending: false })

          setTopics(data || [])
        }
      }
    } catch (error) {
      console.error('Error loading forum:', error)
      toast.error('Error al cargar el foro')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateTopic() {
    if (!newTopicTitle || !newTopicContent || !user) return

    if (!selectedGroupId) {
      console.error('Error: No se puede crear el foro sin un group_id válido')
      toast.error('Selecciona un grupo para crear el foro')
      return
    }

    setPosting(true)
    try {
      await createForumTopic(
        newTopicTitle,
        newTopicContent,
        selectedGroupId,
        user.profile?.organization_id || '',
        user.id
      )

      toast.success('Tema creado')
      setShowNewTopic(false)
      setNewTopicTitle('')
      setNewTopicContent('')
      await loadData()
    } catch (error) {
      console.error('Error creating topic:', error)
      toast.error('Error al crear el tema')
    } finally {
      setPosting(false)
}
  }

  async function handleReply() {
    if (!newPostContent || !selectedTopic || !user || selectedTopic.is_locked) return

    setPosting(true)
    try {
      await createForumPost(selectedTopic.id, user.id, newPostContent)
      toast.success('Respuesta publicada')
      setNewPostContent('')
      await loadData()
    } catch (error) {
      console.error('Error posting reply:', error)
      toast.error('Error al publicar la respuesta')
    } finally {
      setPosting(false)
    }
  }

  async function handleTogglePin() {
    if (!selectedTopic) return
    try {
      await togglePinTopic(selectedTopic.id, !selectedTopic.is_pinned)
      toast.success(selectedTopic.is_pinned ? 'Tema desanclado' : 'Tema anclado')
      await loadData()
    } catch (error) {
      console.error('Error toggling pin:', error)
      toast.error('Error al actualizar el tema')
    }
  }

  async function handleToggleLock() {
    if (!selectedTopic) return
    try {
      await toggleLockTopic(selectedTopic.id, !selectedTopic.is_locked)
      toast.success(selectedTopic.is_locked ? 'Tema desbloqueado' : 'Tema bloqueado')
      await loadData()
    } catch (error) {
      console.error('Error toggling lock:', error)
      toast.error('Error al actualizar el tema')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <svg className="animate-spin w-8 h-8 text-primary-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    )
  }

  if (topicId && selectedTopic) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/forum')}
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver al Foro
        </button>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-start justify-between">
            <div>
              {selectedTopic.is_pinned && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 mb-2">
                  Anclado
                </span>
              )}
              {selectedTopic.is_locked && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 mb-2 ml-2">
                  Bloqueado
                </span>
              )}
              <h2 className="text-xl font-semibold text-slate-900">
                {selectedTopic.title}
              </h2>
            </div>
            {isTeacher && (
              <div className="flex gap-2">
                <button
                  onClick={handleTogglePin}
                  className="p-2 text-slate-500 hover:text-slate-700"
                  title={selectedTopic.is_pinned ? 'Desanclar' : 'Anclar'}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </button>
                <button
                  onClick={handleToggleLock}
                  className="p-2 text-slate-500 hover:text-slate-700"
                  title={selectedTopic.is_locked ? 'Desbloquear' : 'Bloquear'}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </button>
              </div>
            )}
          </div>
          <p className="text-slate-600 mt-4 whitespace-pre-wrap">{selectedTopic.content}</p>
          <p className="text-xs text-slate-500 mt-4">
            {selectedTopic.reply_count} respuestas ·
            Creado el {new Date(selectedTopic.created_at).toLocaleDateString('es-ES')}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-medium text-slate-900 mb-4">Respuestas</h3>
          {posts.length === 0 ? (
            <p className="text-slate-500 text-center py-4">No hay respuestas aún</p>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>

        {!selectedTopic.is_locked && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-medium text-slate-900 mb-4">Nueva Respuesta</h3>
            <textarea
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              placeholder="Escribe tu respuesta..."
              rows={4}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none mb-4"
            />
            <button
              onClick={handleReply}
              disabled={posting || !newPostContent}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {posting ? 'Publicando...' : 'Publicar Respuesta'}
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-slate-900">Foro</h2>
        {!showNewTopic && isTeacher !== false && (
          <button
            onClick={() => setShowNewTopic(true)}
            className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700"
          >
            Nuevo Tema
          </button>
        )}
      </div>

      {showNewTopic && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-medium text-slate-900 mb-4">Crear Nuevo Tema</h3>
          {isTeacher && (
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none mb-4"
            >
              <option value="">Selecciona un grupo...</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          )}
          <input
            type="text"
            value={newTopicTitle}
            onChange={(e) => setNewTopicTitle(e.target.value)}
            placeholder="Título del tema..."
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none mb-4"
          />
          <textarea
            value={newTopicContent}
            onChange={(e) => setNewTopicContent(e.target.value)}
            placeholder="Contenido del tema..."
            rows={4}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none mb-4"
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreateTopic}
              disabled={posting || !newTopicTitle || !newTopicContent || (isTeacher && !selectedGroupId)}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {posting ? 'Creando...' : 'Crear Tema'}
            </button>
            <button
              onClick={() => setShowNewTopic(false)}
              className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {topics.length === 0 ? (
          <div className="p-6 text-center text-slate-500">
            No hay temas en el foro
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {topics.map((topic) => (
              <div
                key={topic.id}
                onClick={() => navigate(`/forum/${topic.id}`)}
                className="p-6 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <div className="flex items-start gap-3">
                  {topic.is_pinned && (
                    <svg className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                  )}
                  <div className="flex-1">
                    <h3 className="font-medium text-slate-900">
                      {topic.title}
                    </h3>
                    <p className="text-sm text-slate-600 line-clamp-2 mt-1">
                      {topic.content}
                    </p>
                    <p className="text-xs text-slate-500 mt-2">
                      {topic.reply_count} respuestas ·{' '}
                      {topic.last_reply_at
                        ? new Date(topic.last_reply_at).toLocaleDateString('es-ES')
                        : new Date(topic.created_at).toLocaleDateString('es-ES')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function PostCard({ post }: { post: ForumPost }) {
  const [authorName, setAuthorName] = useState<string>('')

  useEffect(() => {
    async function loadAuthor() {
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', post.author_id)
        .single()

      if (data) {
        setAuthorName(data.full_name || 'Usuario')
      }
    }
    loadAuthor()
  }, [post.author_id])

  return (
    <div className="border-b border-slate-200 pb-4 last:border-0">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-medium text-slate-900">{authorName}</span>
        <span className="text-xs text-slate-500">
          {new Date(post.created_at).toLocaleString('es-ES')}
        </span>
      </div>
      <p className="text-slate-700 whitespace-pre-wrap">{post.content}</p>
    </div>
  )
}