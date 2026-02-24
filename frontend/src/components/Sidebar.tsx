import { type Branch } from '../types'
import { QUICK_PROMPTS } from '../constants'

interface SidebarProps {
  branch: string
  branches: Branch[]
  isLoading: boolean
  onBranchChange: (branch: string) => void
  onPromptClick: (text: string) => void
  onClear: () => void
}

export default function Sidebar({ branch, branches, isLoading, onBranchChange, onPromptClick, onClear }: SidebarProps) {
  return (
    <aside style={{
      width: 260,
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-2)',
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.02em' }}>
          <span style={{ color: 'var(--accent)' }}>⬡</span> ReviewAgent
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 3, fontFamily: 'var(--mono)' }}>
          powered by LangGraph
        </div>
      </div>

      {/* Branch selector */}
      <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
        <label style={{
          fontSize: '0.65rem', fontFamily: 'var(--mono)', color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 8,
        }}>
          Target Branch
        </label>
        <select
          value={branch}
          onChange={e => onBranchChange(e.target.value)}
          style={{
            width: '100%', background: 'var(--bg-3)', border: '1px solid var(--border)',
            color: 'var(--text)', padding: '0.5rem 0.75rem', borderRadius: 6,
            fontSize: '0.78rem', fontFamily: 'var(--mono)', cursor: 'pointer', outline: 'none',
          }}
        >
          {branches.map(b => (
            <option key={b.name} value={b.name}>{b.name}</option>
          ))}
        </select>
        {branch && (
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 6, fontFamily: 'var(--mono)' }}>
            {branches.find(b => b.name === branch)?.pr}
          </div>
        )}
      </div>

      {/* Quick prompts */}
      <div style={{ padding: '1rem 1.25rem', flex: 1, overflowY: 'auto' }}>
        <div style={{
          fontSize: '0.65rem', fontFamily: 'var(--mono)', color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8,
        }}>
          Quick Prompts
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {QUICK_PROMPTS.map(p => (
            <button
              key={p.text}
              onClick={() => onPromptClick(p.text)}
              disabled={isLoading || !branch}
              style={{
                background: 'transparent', border: '1px solid var(--border)',
                color: 'var(--text-dim)', padding: '0.45rem 0.75rem', borderRadius: 6,
                fontSize: '0.75rem', fontFamily: 'var(--sans)', cursor: 'pointer',
                textAlign: 'left', transition: 'all 0.15s', opacity: isLoading ? 0.5 : 1,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--accent-glow)'
                e.currentTarget.style.borderColor = 'var(--accent-dim)'
                e.currentTarget.style.color = 'var(--text)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.color = 'var(--text-dim)'
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Clear */}
      <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--border)' }}>
        <button
          onClick={onClear}
          style={{
            width: '100%', background: 'transparent', border: '1px solid var(--border)',
            color: 'var(--text-muted)', padding: '0.5rem', borderRadius: 6,
            fontSize: '0.75rem', fontFamily: 'var(--mono)', cursor: 'pointer',
          }}
        >
          clear chat
        </button>
      </div>
    </aside>
  )
}