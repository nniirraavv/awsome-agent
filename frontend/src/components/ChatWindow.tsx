import { useEffect, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { Tenant } from '../types/index.ts'
import { useChat } from '../hooks/useChat.ts'
import MessageBubble from './MessageBubble.tsx'
import InputBar from './InputBar.tsx'
import ThinkingIndicator from './ThinkingIndicator.tsx'
import Sidebar from './Sidebar.tsx'

const API = import.meta.env.VITE_API_HTTP_URL ?? ''

interface Props {
  tenant: Tenant
  onTenantUpdate: (t: Tenant) => void
}

export default function ChatWindow({ tenant, onTenantUpdate }: Props) {
  const [sessionId, setSessionId] = useState(() => uuidv4())
  const [sessions, setSessions] = useState<string[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  const { messages, activeTools, connected, streaming, sendMessage } = useChat(sessionId, tenant.tenantId)

  // Load session history on mount
  useEffect(() => {
    fetch(`${API}/tenant/history`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` },
    })
      .then(r => r.ok ? r.json() : { sessions: [] })
      .then((data: { sessions: string[] }) => setSessions(data.sessions))
      .catch(() => { /* ignore */ })
  }, [])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, activeTools])

  function handleRescan() {
    fetch(`${API}/tenant/me`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then((t: Tenant | null) => { if (t) onTenantUpdate(t) })
      .catch(() => { /* ignore */ })
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      <Sidebar
        tenant={tenant}
        sessions={sessions}
        currentSessionId={sessionId}
        onSelectSession={setSessionId}
        onNewSession={() => setSessionId(uuidv4())}
        onRescan={handleRescan}
      />

      {/* Main chat area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between border-b border-gray-800 px-6 py-3">
          <h1 className="text-sm font-semibold text-white">AWS DevOps Assistant</h1>
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className="text-xs text-gray-500">{connected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500/10">
                <svg className="h-8 w-8 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-white">Ask about your AWS account</h2>
              <p className="mt-2 max-w-sm text-sm text-gray-400">
                I have read-only access to your infrastructure. Ask me about costs, alarms, unused resources, security findings, and more.
              </p>
              <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    disabled={!connected}
                    className="rounded-xl border border-gray-800 bg-gray-900 px-4 py-3 text-left text-sm text-gray-300 transition-colors hover:border-orange-500/30 hover:bg-gray-800"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(msg => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          <ThinkingIndicator activeTools={activeTools} />
          <div ref={bottomRef} />
        </div>

        <InputBar onSend={sendMessage} disabled={!connected || streaming} />
      </div>
    </div>
  )
}

const SUGGESTIONS = [
  'What CloudWatch alarms are currently in ALARM state?',
  'Show me my top 5 most expensive services this month',
  'Are there any unused EC2 instances or EBS volumes?',
  'Check my IAM configuration for security issues',
]
