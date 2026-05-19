import { useCallback, useEffect, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { ChatMessage, ServerEvent } from '../types/index.ts'

const WS_URL = import.meta.env.VITE_API_WS_URL ?? 'ws://localhost:3001'

export function useChat(sessionId: string, tenantId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [activeTools, setActiveTools] = useState<string[]>([])
  const [connected, setConnected] = useState(false)
  const [ready, setReady] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const pendingAssistantId = useRef<string | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('token') ?? ''
    const ws = new WebSocket(`${WS_URL}/chat/stream?token=${token}&tenantId=${tenantId}`)
    wsRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onclose = () => { setConnected(false); setReady(false) }

    ws.onmessage = (e) => {
      const event = JSON.parse(e.data as string) as ServerEvent

      if (event.type === 'text_delta') {
        setMessages(msgs => {
          const id = pendingAssistantId.current
          if (!id) return msgs
          return msgs.map(m =>
            m.id === id ? { ...m, content: m.content + event.delta } : m
          )
        })
      } else if (event.type === 'tool_start') {
        setActiveTools(t => [...t, event.toolName])
      } else if (event.type === 'tool_end') {
        setActiveTools(t => t.filter(n => n !== event.toolName))
      } else if (event.type === 'message_end') {
        setStreaming(false)
        setActiveTools([])
        pendingAssistantId.current = null
      } else if (event.type === 'ready') {
        setReady(true)
      } else if (event.type === 'error') {
        setStreaming(false)
        setActiveTools([])
        const pendingId = pendingAssistantId.current
        pendingAssistantId.current = null
        setMessages(msgs => {
          const errorText = `Error: ${event.message}`
          if (pendingId) {
            // Replace the spinner bubble with the error text
            return msgs.map(m => m.id === pendingId ? { ...m, content: errorText } : m)
          }
          return [...msgs, { id: uuidv4(), role: 'assistant', content: errorText, timestamp: new Date().toISOString() }]
        })
      }
    }

    return () => { ws.close() }
  }, [sessionId, tenantId])

  const sendMessage = useCallback((content: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

    const userMsg: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    }
    const assistantId = uuidv4()
    pendingAssistantId.current = assistantId
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    }

    setMessages(msgs => [...msgs, userMsg, assistantMsg])
    setStreaming(true)

    wsRef.current.send(JSON.stringify({ type: 'chat', sessionId, content }))
  }, [sessionId])

  return { messages, activeTools, connected, ready, streaming, sendMessage }
}
