import React from 'react'

interface StatusDotProps {
  status: 'idle' | 'connecting' | 'connected' | 'error'
}

function StatusDotInner({ status }: StatusDotProps) {
  const cls =
    status === 'connected'  ? 'dot dot-live'  :
    status === 'connecting' ? 'dot dot-think' :
    status === 'error'      ? 'dot'            :
    'dot dot-idle'

  const errorStyle = status === 'error' ? { background: 'var(--danger)' } : undefined

  return <span className={cls} style={errorStyle} />
}

export const StatusDot = React.memo(StatusDotInner)
