'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Upload, X, CheckCircle, AlertCircle } from 'lucide-react'
import { uploadPDF, deletePDF } from '@/lib/api'
import { useInterviewStore } from '@/store/useInterviewStore'
import { cn } from '@/lib/utils'

export function CVUpload() {
  const { uploadedPDFs, addPDF, removePDF } = useInterviewStore()
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleUpload = useCallback(
    async (file: File) => {
      if (file.type !== 'application/pdf') {
        setError('Only PDF files are allowed')
        return
      }
      setUploading(true)
      setError(null)
      try {
        const { filename } = await uploadPDF(file)
        addPDF(filename)
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setUploading(false)
      }
    },
    [addPDF],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleUpload(file)
    },
    [handleUpload],
  )

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
    e.target.value = ''
  }

  const handleDelete = async (filename: string) => {
    try {
      await deletePDF(filename)
      removePDF(filename)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-white/80">📄 CV / Resume</label>
        <span className="text-xs text-white/30">Optional — for personalized answers</span>
      </div>

      <AnimatePresence mode="wait">
        {uploadedPDFs.length === 0 ? (
          <motion.label
            key="dropzone"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
              'block cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition-all duration-200',
              isDragging
                ? 'border-violet-500/60 bg-violet-500/5'
                : 'border-white/10 hover:border-white/20 hover:bg-white/[0.02]',
              uploading && 'pointer-events-none opacity-50',
            )}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <input type="file" accept=".pdf" onChange={handleFileInput} className="hidden" />
            <Upload
              className={cn('w-6 h-6 mx-auto mb-2 transition-colors', isDragging ? 'text-violet-400' : 'text-white/20')}
            />
            <p className="text-sm text-white/40">
              {uploading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin inline-block" />
                  Uploading...
                </span>
              ) : (
                'Drop PDF here or click to browse'
              )}
            </p>
          </motion.label>
        ) : (
          <motion.div
            key="file-list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-1.5"
          >
            {uploadedPDFs.map((filename) => (
              <div
                key={filename}
                className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2.5 border border-white/5"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="shrink-0 w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-violet-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-white/80 font-medium truncate">{filename}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
                      <p className="text-xs text-emerald-400">Ready for RAG</p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(filename)}
                  className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {uploadedPDFs.length < 3 && (
              <label className="flex items-center gap-1.5 cursor-pointer text-xs text-violet-400/70 hover:text-violet-400 transition-colors px-1 py-1">
                <input type="file" accept=".pdf" onChange={handleFileInput} className="hidden" />
                <Upload className="w-3 h-3" />
                Add another PDF
              </label>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div className="flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}
    </div>
  )
}
