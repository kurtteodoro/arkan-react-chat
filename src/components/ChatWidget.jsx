import React, { useEffect, useMemo, useRef, useState } from 'react'
import WebcamModal from './WebcamModal.jsx'
import { BotApi } from '../services/botApi.js'

export default function ChatWidget({ onSend, onClose }) {
  const api = useMemo(() => new BotApi(), [])
  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const bodyRef = useRef(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    ;(async () => {
      try {
        await api.login()
        await api.trackView()
        const step = await api.startSession()
        handleStep(step)
      } catch (e) {
        pushBot(`Erro ao iniciar sessão: ${e.message}`)
      } finally {
        setLoading(false)
      }
    })()
  }, [api])

  function pushUser(text) {
    setMessages((m) => [...m, { who: 'user', text }])
  }
  function pushBot(text) {
    setMessages((m) => [...m, { who: 'bot', text }])
  }

  // Generic handler for backend step response
  function handleStep(step) {
    // Render minimal info. You can customize here to map your StepResponseDTO.
    if (!step) return
    if (typeof step === 'string') { pushBot(step); return }
    // best-effort common fields:
    if (step.mensagem) pushBot(step.mensagem)
    if (Array.isArray(step.mensagens)) step.mensagens.forEach(t => pushBot(t))
    if (step.proximaEtapa) {
      // no-op: just demonstrate
    }
  }

  async function sendText() {
    const val = input.trim()
    if (!val) return
    setInput('')
    pushUser(val)
    try {
      const step = await api.sendText(val)
      handleStep(step)
    } catch (e) {
      pushBot('Falha ao enviar: ' + e.message)
    }
  }

  function resetChat() {
    BotApi.resetSession()
    // Hard refresh avoids any sticky caches
    window.location.reload(true)
  }

  return (
    <div className="chat">
      <WebcamModal
          open={true}
          onClose={onClose}
          onCapture={onSend}
      />
    </div>
  )
}
