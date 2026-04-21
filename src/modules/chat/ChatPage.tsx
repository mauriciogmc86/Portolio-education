'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase, type Profile } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import toast from 'react-hot-toast'
import type { RealtimeChannel } from '@supabase/supabase-js'
import {
  getMyConversations,
  getConversationMessages,
  getOrCreateDirectConversation,
  createGroupConversation,
  sendMessage,
  subscribeToConversation,
  markAsRead,
  unsubscribe,
  type Conversation,
  type ChatMessage,
} from '@/services/chatService'

export function ChatPage() {
  const { conversationId } = useParams()
  const { user } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [channel, setChannel] = useState<RealtimeChannel | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showNewChat, setShowNewChat] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const isTeacher = user?.profile?.role === 'teacher' || user?.profile?.role === 'admin' || user?.profile?.role === 'super_admin'

  useEffect(() => {
    loadData()
  }, [user])

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id)
    }

    return () => {
      if (channel) {
        unsubscribe(channel)
      }
    }
  }, [selectedConversation])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  async function loadData() {
    if (!user) return

    setLoading(true)
    try {
      const orgId = user.profile?.organization_id
      await Promise.all([
        loadConversations(),
        loadProfiles()
      ])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadConversations() {
    if (!user) return
    
    try {
      const convs = await getMyConversations(user.id, user.profile?.organization_id || undefined)
      setConversations(convs)

      if (conversationId && !selectedConversation) {
        const { data: convData } = await supabase
          .from('conversations')
          .select('*')
          .eq('id', conversationId)
          .single()

        if (convData) {
          setSelectedConversation(convData as Conversation)
        }
      }
    } catch (error) {
      console.error('Error loading conversations:', error)
    }
  }

  async function loadProfiles() {
    if (!user?.profile?.organization_id) return

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('organization_id', user.profile.organization_id)
      .neq('id', user.id)
      .order('full_name')

    if (error) {
      console.error('Error loading profiles:', error)
    } else {
      setProfiles(data || [])
    }
  }

  async function loadMessages(convId: string) {
    if (!user) return

    try {
      setLoading(true)
      
      if (channel) {
        unsubscribe(channel)
      }

      const msgs = await getConversationMessages(convId)
      setMessages(msgs)

      const newChannel = subscribeToConversation(convId, (message) => {
        setMessages((prev) => [...prev, message])
      })
      setChannel(newChannel)

      const unreadInThisChat = await markAsRead(convId, user.id)
      if (unreadInThisChat > 0) {
        window.dispatchEvent(new CustomEvent('chat-read', { detail: { count: unreadInThisChat } }))
      }
    } catch (error) {
      console.error('Error loading messages:', error)
      toast.error('Error al cargar los mensajes')
    } finally {
      setLoading(false)
    }
  }

  async function handleStartChat(profile: Profile) {
    if (!user) return

    const orgId = user.profile?.organization_id
    if (!orgId) {
      toast.error('No perteneces a ninguna organización')
      return
    }

    try {
      const conv = await getOrCreateDirectConversation(
        user.id,
        profile.id,
        orgId
      )
      
      setSelectedConversation(conv)
      setSelectedProfile(profile)
      setShowNewChat(false)
      await loadConversations()
    } catch (error) {
      console.error('Error starting chat:', error)
      toast.error('Error al iniciar chat')
    }
  }

  async function handleSend() {
    if (!newMessage.trim() || !selectedConversation || !user || sending) return

    setSending(true)
    try {
      await sendMessage(selectedConversation.id, user.id, newMessage.trim())
      setNewMessage('')
      await loadMessages(selectedConversation.id)
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error('Error al enviar el mensaje')
    } finally {
      setSending(false)
    }
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  function handleKeyPress(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const filteredProfiles = profiles.filter(p => 
    p.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading && conversations.length === 0 && profiles.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <svg className="animate-spin w-8 h-8 text-primary-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-12rem)] flex">
      <div className="w-72 border-r border-slate-200 bg-white overflow-y-auto">
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-slate-900">Chats</h3>
            <button
              onClick={() => setShowNewChat(true)}
              className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg"
              title="Nueva conversación"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </div>
        
        {showNewChat ? (
          <div className="p-2">
            <div className="flex items-center justify-between px-3 py-2">
              <button
                onClick={() => setShowNewChat(false)}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                ← Volver
              </button>
            </div>
            <p className="px-3 py-2 text-xs text-slate-500">
              Selecciona un usuario para chatear:
            </p>
            {filteredProfiles.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-500">
                No hay usuarios disponibles
              </div>
            ) : (
              filteredProfiles.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => handleStartChat(profile)}
                  className="w-full text-left px-3 py-3 rounded-lg text-sm transition-colors flex items-center gap-3 text-slate-600 hover:bg-slate-100"
                >
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-medium text-primary-700">
                      {(profile.full_name || profile.email || 'U')[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-sm">
                      {profile.full_name || profile.email?.split('@')[0]}
                    </p>
                    <p className="text-xs text-slate-500 capitalize">{profile.role}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="p-2">
            {conversations.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-500">
                No hay conversaciones
              </div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => {
                    setSelectedConversation(conv)
                    setSelectedProfile(null)
                  }}
                  className={`w-full text-left px-3 py-3 rounded-lg text-sm transition-colors flex items-center gap-3 ${
                    selectedConversation?.id === conv.id
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                    {conv.other_participant?.avatar_url || conv.avatar_url ? (
                      <img src={conv.other_participant?.avatar_url ?? conv.avatar_url ?? ''} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <span className="text-sm font-medium text-primary-700">
                        {conv.type === 'group' 
                          ? (conv.name || 'G')[0].toUpperCase() 
                          : (conv.other_participant?.full_name || conv.other_participant?.id || 'D')[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {conv.type === 'group' 
                        ? conv.name 
                        : conv.other_participant?.full_name || 'Mensaje Directo'}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {conv.last_message_at 
                        ? new Date(conv.last_message_at).toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'})
                        : 'Sin mensajes'}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            <div className="p-4 border-b border-slate-200 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                  {selectedConversation.other_participant?.avatar_url || selectedConversation.avatar_url ? (
                    <img src={selectedConversation.other_participant?.avatar_url ?? selectedConversation.avatar_url ?? ''} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <span className="text-sm font-medium text-primary-700">
                      {selectedConversation.type === 'group' 
                        ? (selectedConversation.name || 'G')[0].toUpperCase() 
                        : (selectedConversation.other_participant?.full_name || 'D')[0].toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="font-medium text-slate-900">
                    {selectedConversation.type === 'group' 
                      ? selectedConversation.name 
                      : selectedConversation.other_participant?.full_name || 'Mensaje Directo'}
                  </h3>
                  <p className="text-xs text-slate-500 capitalize">
                    {selectedConversation.type}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center text-sm text-slate-500 py-8">
                  No hay mensajes aún. ¡Inicia la conversación!
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.sender_id === user?.id ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[70%] px-4 py-2 rounded-lg ${
                        message.sender_id === user?.id
                          ? 'bg-primary-600 text-white'
                          : 'bg-slate-100 text-slate-900'
                      }`}
                    >
                      {message.sender_id !== user?.id && (
                        <p className="text-xs font-medium mb-1 opacity-75">
                          {message.sender_full_name || 'Usuario'}
                        </p>
                      )}
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <p
                        className={`text-xs mt-1 ${
                          message.sender_id === user?.id
                            ? 'text-primary-100'
                            : 'text-slate-500'
                        }`}
                      >
                        {new Date(message.created_at).toLocaleTimeString('es-ES', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-slate-200 bg-white">
              <div className="flex gap-2">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Escribe un mensaje..."
                  rows={1}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !newMessage.trim()}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500">
            Selecciona una conversación o inicia una nueva
          </div>
        )}
      </div>
    </div>
  )
}