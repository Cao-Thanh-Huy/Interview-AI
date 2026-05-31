import React from 'react'

interface QuestionBlockProps {
  question: string
  questionTranslation?: string
}

export const QuestionBlock: React.FC<QuestionBlockProps> = ({ question, questionTranslation }) => (
  <div style={{ width: '100%', maxWidth: '100%', overflow: 'visible', marginBottom: questionTranslation ? 4 : 8 }}>
    <p
      className="transcript-q"
      style={{
        margin: 0,
        fontWeight: 600,
        fontSize: 15,
        color: 'var(--text)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        overflow: 'visible',
        background: 'none',
        boxShadow: 'none',
        padding: 0,
      }}
    >
      {question}
    </p>
    {questionTranslation && (
      <p
        style={{
          margin: 0,
          marginTop: 2,
          marginBottom: 8,
          fontSize: 13,
          color: 'var(--muted)',
          fontStyle: 'italic',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          overflow: 'visible',
          background: 'none',
          boxShadow: 'none',
          padding: 0,
        }}
      >
        🇻🇳 {questionTranslation}
      </p>
    )}
  </div>
)
