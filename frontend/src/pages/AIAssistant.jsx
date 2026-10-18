import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, RefreshCw, Send, Sparkles, Square } from 'lucide-react'
import Card from '../components/ui/Card'
import Markdown from '../components/ui/Markdown'
import Notice from '../components/ui/Notice'
import PageHeader from '../components/ui/PageHeader'
import { useVehicleData } from '../context/VehicleDataContext'
import { ApiError } from '../lib/apiClient'
import { askCopilot } from '../services/api'

const SUGGESTIONS = [
  'Why is my battery’s risk level what it is?',
  'How has my battery health changed over time?',
  'Is there anything unusual in my recent charging sessions?',
  'What does the health index mean, and why can it be above 100?',
]
const MAX_LEN = 1000

/** One clear sentence for every way the assistant can fail. */
function failureText(err) {
  if (!(err instanceof ApiError)) return 'The assistant could not answer. Please try again.'
  switch (err.status ?? err.kind) {
    case 501:
      return 'The AI assistant is not set up on the server yet, so it cannot answer questions.'
    case 503:
      return 'The AI service is temporarily unavailable. Please try again in a few minutes.'
    case 403:
      return 'You can only ask about the vehicle assigned to your account.'
    case 404:
      return 'The assistant could not find data for this vehicle.'
    case 429:
      return 'Too many questions in a short time. Please wait a moment and try again.'
    case 400:
      return err.detail || 'The assistant could not process that question.'
    default:
  }
  if (err.kind === 'timeout') return 'The assistant took too long to answer. Please try again.'
  if (err.kind === 'network') return 'Cannot reach the CellTriage server. Check your connection and try again.'
  return 'The assistant ran into a problem. Please try again.'
}

let nextId = 1
const newId = () => nextId++

function Message({ m, onRetry }) {
  if (m.role === 'user') {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-accent-dim px-4 py-2.5 text-[13.5px] text-text-primary">{m.text}</p>
      </div>
    )
  }
  if (m.role === 'pending') {
    return (
      <div className="flex items-center gap-2 text-[13px] text-text-secondary" role="status">
        <Loader2 size={15} className="animate-spin text-accent" aria-hidden="true" /> The assistant is working on it…
      </div>
    )
  }
  if (m.role === 'error') {
    return (
      <div className="max-w-[90%]">
        <Notice tone="warn" title="No answer received" onRetry={onRetry}>{m.text}</Notice>
      </div>
    )
  }
  return (
    <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-app-border bg-app-surface px-4 py-3">
      <Markdown>{m.text}</Markdown>
      {m.tools?.length > 0 && (
        <p className="mt-3 border-t border-app-borderMuted pt-2 text-[11px] text-text-muted">
          Data the assistant looked up: {m.tools.map((t) => t.replace(/^get_/, '').replace(/_/g, ' ')).join(', ')}
        </p>
      )}
    </div>
  )
}

export default function AIAssistant() {
  const { vehicleId } = useVehicleData()
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(false)
  const controllerRef = useRef(null)
  const endRef = useRef(null)

  // Stop any in-flight request when leaving, or when another vehicle is chosen.
  useEffect(() => {
    setMessages([])
    return () => controllerRef.current?.abort()
  }, [vehicleId])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  const send = useCallback(
    async ({ message = null, runAnalysis = false, label }) => {
      if (pending) return
      const controller = new AbortController()
      controllerRef.current = controller
      setPending(true)
      setMessages((prev) => [
        ...prev.filter((m) => m.role !== 'error'),
        { id: newId(), role: 'user', text: label ?? message },
        { id: 'pending', role: 'pending' },
      ])
      try {
        const res = await askCopilot({ message, vehicleId, runAnalysis }, controller.signal)
        const answer = typeof res?.answer === 'string' ? res.answer.trim() : ''
        setMessages((prev) => [
          ...prev.filter((m) => m.role !== 'pending'),
          answer
            ? { id: newId(), role: 'assistant', text: answer, tools: Array.isArray(res.tools_used) ? res.tools_used : [] }
            : { id: newId(), role: 'error', text: 'The assistant returned an empty answer.', retry: { message, runAnalysis, label } },
        ])
      } catch (err) {
        if (err?.kind === 'aborted') {
          setMessages((prev) => prev.filter((m) => m.role !== 'pending'))
        } else {
          setMessages((prev) => [
            ...prev.filter((m) => m.role !== 'pending'),
            { id: newId(), role: 'error', text: failureText(err), retry: { message, runAnalysis, label } },
          ])
        }
      } finally {
        setPending(false)
      }
    },
    [pending, vehicleId],
  )

  const submit = (e) => {
    e?.preventDefault()
    const text = draft.trim()
    if (!text || pending) return
    setDraft('')
    send({ message: text })
  }

  const retry = (m) => {
    // drop the failed exchange (its question and the error) before asking again
    setMessages((prev) => {
      const i = prev.findIndex((x) => x.id === m.id)
      return prev.filter((_, k) => k !== i && k !== i - 1)
    })
    setTimeout(() => send(m.retry), 0)
  }

  const empty = messages.length === 0

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-6">
      <PageHeader title="AI Assistant" subtitle={`Ask about the battery health and telemetry recorded for vehicle ${vehicleId}.`} />
      <Card radius="cardLg" className="flex flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto p-5" style={{ minHeight: '20rem', maxHeight: '55vh' }} aria-live="polite" aria-label="Conversation">
          {empty ? (
            <div className="flex h-full min-h-[16rem] flex-col items-center justify-center text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-dim text-accent-strong">
                <Sparkles size={18} aria-hidden="true" />
              </span>
              <p className="mt-3 text-[15px] font-semibold text-text-primary">What would you like to know?</p>
              <p className="mt-1 text-[13px] text-text-secondary">Pick a question, run a full analysis, or write your own.</p>
              <div className="mt-5 flex max-w-xl flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send({ message: s })}
                    disabled={pending}
                    className="hover-edge rounded-pill border border-app-border bg-app-surface px-3.5 py-1.5 text-xs font-medium text-text-secondary hover:border-accent/40 hover:text-text-primary disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => <Message key={m.id} m={m} onRetry={m.retry ? () => retry(m) : undefined} />)
          )}
          <div ref={endRef} />
        </div>

        <div className="border-t border-app-border p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => send({ runAnalysis: true, label: 'Run a full health analysis' })}
              disabled={pending}
              className="hover-edge inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent-dim px-3 py-1.5 text-xs font-semibold text-accent-strong disabled:opacity-50"
            >
              <RefreshCw size={12} aria-hidden="true" /> Run full health analysis
            </button>
            {pending && (
              <button
                type="button"
                onClick={() => controllerRef.current?.abort()}
                className="hover-edge inline-flex items-center gap-1.5 rounded-md border border-app-border px-3 py-1.5 text-xs font-medium text-text-primary hover:border-accent/40"
              >
                <Square size={11} aria-hidden="true" /> Stop
              </button>
            )}
          </div>
          <form onSubmit={submit} className="flex items-end gap-2">
            <label htmlFor="ask" className="sr-only">Your question</label>
            <textarea
              id="ask"
              rows={2}
              value={draft}
              maxLength={MAX_LEN}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) submit(e)
              }}
              placeholder="Ask about your battery… (Enter to send, Shift+Enter for a new line)"
              className="min-h-[3rem] flex-1 resize-none rounded-md border border-app-border bg-app-surface px-3 py-2 text-[13.5px] text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
            />
            <button
              type="submit"
              disabled={pending || !draft.trim()}
              aria-label="Send question"
              className="hover-edge flex h-11 w-11 items-center justify-center rounded-md bg-accent text-app-surface hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </Card>

      <Notice title="Read answers with care">
        Answers are generated by an AI model from your vehicle's recorded data and can be wrong. Check anything important against the other pages. Each question is
        answered on its own, so the assistant does not remember earlier ones.
      </Notice>
    </div>
  )
}
