import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useInterviewStore } from '@/store/useInterviewStore'
import { useUiMode } from '@/store/useUiMode'

// Electron IPC helper (safe — fallback when not in Electron)
const win = typeof window !== 'undefined' ? (window as any).electronWindow : null

interface Command {
  id: string
  label: string
  shortcut?: string
  group: string
  action: () => void
}

interface Props {
  isOpen: boolean
  onClose: () => void
}

function CommandPaletteInner({ isOpen, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const { phase, setPhase, toggleStealth } = useInterviewStore()
  const { setAlwaysOnTop } = useUiMode()

  const setOpacity = useCallback((v: number) => {
    win?.setOpacity(v)
  }, [])

  const toggleAOT = useCallback(() => {
    win?.toggleAlwaysOnTop()
  }, [])

  const COMMANDS: Command[] = [
    // Session
    {
      id: 'start', group: 'Session',
      label: phase === 'setup' ? 'Start Interview Session' : 'Session already active',
      action: () => { if (phase === 'setup') setPhase('interview'); onClose() },
    },
    {
      id: 'stop', group: 'Session',
      label: 'Stop Interview Session',
      action: () => { setPhase('setup'); onClose() },
    },
    {
      id: 'stealth', group: 'Session',
      label: 'Toggle Stealth Mode',
      shortcut: 'Ctrl+Shift+H',
      action: () => { toggleStealth(); onClose() },
    },
    // Window
    {
      id: 'aot', group: 'Window',
      label: 'Toggle Always on Top',
      shortcut: 'Ctrl+Shift+T',
      action: () => { toggleAOT(); onClose() },
    },
    { id: 'op90', group: 'Window', label: 'Opacity 90%', action: () => { setOpacity(0.9); onClose() } },
    { id: 'op75', group: 'Window', label: 'Opacity 75%', action: () => { setOpacity(0.75); onClose() } },
    { id: 'op50', group: 'Window', label: 'Opacity 50%', action: () => { setOpacity(0.5); onClose() } },
    { id: 'op100', group: 'Window', label: 'Opacity 100%', action: () => { setOpacity(1); onClose() } },
  ]

  const filtered = query.trim()
    ? COMMANDS.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))
    : COMMANDS

  // Reset selection when filter changes
  useEffect(() => setSelected(0), [query])

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [isOpen])

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)) }
    if (e.key === 'Enter')     { e.preventDefault(); filtered[selected]?.action() }
    if (e.key === 'Escape')    { e.preventDefault(); onClose() }
  }, [filtered, selected, onClose])

  if (!isOpen) return null

  // Group items
  const groups = Array.from(new Set(filtered.map((c) => c.group)))

  return (
    <div
      className="palette-overlay"
      onClick={onClose}
      style={{ paddingTop: 100 }}
    >
      <div
        className="palette-panel"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        style={{ width: 480 }}
      >
        {/* Search input */}
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--line)' }}>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command..."
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text)',
              fontSize: 14,
              fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Results */}
        <div style={{ maxHeight: 360, overflowY: 'auto', padding: '4px 0' }}>
          {filtered.length === 0 && (
            <div style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: 13 }}>
              No commands found
            </div>
          )}
          {groups.map((group) => (
            <div key={group}>
              <div style={{ padding: '6px 12px 2px', fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                {group}
              </div>
              {filtered
                .filter((c) => c.group === group)
                .map((cmd) => {
                  const idx = filtered.indexOf(cmd)
                  const isActive = idx === selected
                  return (
                    <button
                      key={cmd.id}
                      onClick={cmd.action}
                      onMouseEnter={() => setSelected(idx)}
                      style={{
                        width: '100%',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '7px 12px',
                        background: isActive ? 'var(--surface-hover)' : 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 13,
                        color: isActive ? 'var(--text)' : 'var(--text-2)',
                        textAlign: 'left',
                        transition: 'background 80ms ease-out',
                        fontFamily: 'inherit',
                      }}
                    >
                      <span>{cmd.label}</span>
                      {cmd.shortcut && (
                        <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace', marginLeft: 12, flexShrink: 0 }}>
                          {cmd.shortcut}
                        </span>
                      )}
                    </button>
                  )
                })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '6px 12px', borderTop: '1px solid var(--line)', display: 'flex', gap: 12, fontSize: 11, color: 'var(--muted)' }}>
          <span>↑↓ navigate</span>
          <span>↵ run</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  )
}

export const CommandPalette = React.memo(CommandPaletteInner)
