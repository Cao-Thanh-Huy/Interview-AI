import React from 'react'
import { Mic, BrainCircuit, History, Target } from 'lucide-react'

export type SidebarTab = 'setup' | 'training' | 'history' | 'mock'

const NAV: { id: SidebarTab; icon: React.ReactNode; label: string }[] = [
  { id: 'setup',    icon: <Mic size={18} />,          label: 'Setup Session' },
  { id: 'training', icon: <BrainCircuit size={18} />, label: 'Pre-Interview Training' },
  { id: 'history',  icon: <History size={18} />,      label: 'Interview History' },
  { id: 'mock',     icon: <Target size={18} />,       label: 'Mock Interview' },
]

interface Props {
  activeTab: SidebarTab
  onTabChange: (tab: SidebarTab) => void
}

function SidebarInner({ activeTab, onTabChange }: Props) {
  return (
    <aside className="sidebar">
      {/* Logo mark — flat wordmark */}
      <div
        title="IntelliView"
        style={{
          width: 32, height: 32,
          borderRadius: 6,
          background: 'var(--surface)',
          border: '1px solid var(--line-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 16,
          flexShrink: 0,
          color: 'var(--primary)',
          fontSize: 11, fontWeight: 700, letterSpacing: '-0.03em',
          userSelect: 'none',
        }}
      >
        IV
      </div>

      {/* Nav icons */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        {NAV.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            title={item.label}
            className={`nav-icon${activeTab === item.id ? ' active' : ''}`}
          >
            {item.icon}
          </button>
        ))}
      </nav>
    </aside>
  )
}

export const Sidebar = React.memo(SidebarInner)
