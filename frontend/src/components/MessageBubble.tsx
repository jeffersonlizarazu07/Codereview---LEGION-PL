import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {type Message } from '../types'

/* Renderiza un mensaje del chat con diferentes estilos según el rol (user/assistant). Los mensajes del agente soportan Markdown y tienen un cursor parpadeante durante streaming */
export default function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      marginBottom: '1.5rem',
      animation: 'fadeUp 0.25s ease',
    }}>
      <div style={{
        fontSize: '0.65rem',
        fontFamily: 'var(--mono)',
        color: 'var(--text-muted)',
        marginBottom: '0.35rem',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        {isUser ? '▸ you' : (
          <>
            ▸ agent
            {message.mode && message.mode !== 'unknown' && (
              <span style={{
                background: 'var(--accent-glow)',
                border: '1px solid var(--accent-dim)',
                color: 'var(--accent)',
                padding: '0 5px',
                borderRadius: 3,
                fontSize: '0.6rem',
              }}>
                {message.mode}
              </span>
            )}
          </>
        )}
      </div>

      <div style={{
        maxWidth: '85%',
        background: isUser ? 'var(--accent-glow)' : 'var(--bg-2)',
        border: `1px solid ${isUser ? 'var(--accent-dim)' : 'var(--border)'}`,
        borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
        padding: '0.85rem 1rem',
        fontSize: '0.875rem',
        lineHeight: 1.6,
      }}>
        {isUser ? (
          <span style={{ color: 'var(--text)' }}>{message.content}</span>
        ) : (
          <div className="markdown-body" style={{ color: 'var(--text)' }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
            {message.isStreaming && (
              <span style={{
                display: 'inline-block',
                width: 2, height: '1em',
                background: 'var(--accent)',
                marginLeft: 2,
                animation: 'blink 1s step-end infinite',
                verticalAlign: 'text-bottom',
              }} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}