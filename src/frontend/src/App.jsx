import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Loader2,
  Send,
  RotateCcw,
  Upload,
  FileText,
  X,
  Zap,
  Terminal,
  Code2,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  Cpu,
  Layers,
} from 'lucide-react'
import './App.css'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatElapsed(seconds) {
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const m = Math.floor(seconds / 60)
  const s = (seconds % 60).toFixed(0)
  return `${m}m ${s}s`
}

function truncate(str, maxLen = 300) {
  if (!str) return ''
  return str.length > maxLen ? str.slice(0, maxLen) + '…' : str
}

// ---------------------------------------------------------------------------
// Iteration Card Component
// ---------------------------------------------------------------------------

function IterationCard({ step, isLatest }) {
  const [expanded, setExpanded] = useState(isLatest)

  useEffect(() => {
    if (isLatest) setExpanded(true)
  }, [isLatest])

  const hasCode = !!step.code_executed
  const hasOutput = step.repl_output !== null && step.repl_output !== undefined && step.repl_output !== ''
  const isError = hasOutput && step.repl_output.includes('Traceback')

  return (
    <div className={`rounded-xl border transition-all duration-300 ${
      isLatest
        ? 'border-emerald-500/40 bg-emerald-950/10 shadow-lg shadow-emerald-500/5'
        : 'border-zinc-800/80 bg-zinc-900/30'
    }`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-5 py-3.5 text-left cursor-pointer hover:bg-zinc-800/20 transition-colors rounded-xl"
      >
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
          isLatest
            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
        }`}>
          {step.iteration}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${isLatest ? 'text-emerald-300' : 'text-zinc-300'}`}>
              Iteration {step.iteration}
            </span>
            {hasCode && (
              <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] px-1.5 py-0.5 rounded-md font-mono">
                CODE
              </span>
            )}
            {step.sub_call_count > 0 && (
              <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] px-1.5 py-0.5 rounded-md font-mono">
                {step.sub_call_count} sub-call{step.sub_call_count !== 1 ? 's' : ''}
              </span>
            )}
            {isError && (
              <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] px-1.5 py-0.5 rounded-md font-mono">
                ERROR
              </span>
            )}
          </div>
          {!expanded && step.assistant_text && (
            <p className="text-xs text-zinc-500 mt-0.5 truncate">
              {truncate(step.assistant_text, 120)}
            </p>
          )}
        </div>

        {expanded ? (
          <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
        )}
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-5 pb-4 space-y-3 border-t border-zinc-800/50 pt-3">
          {/* Root Model Response */}
          {step.assistant_text && (
            <div>
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-medium mb-1.5">
                <MessageSquare className="w-3 h-3" />
                <span>Root Model Response</span>
              </div>
              <div className="bg-black/40 border border-zinc-800/60 rounded-lg p-3 text-xs text-zinc-300 font-mono leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap">
                {step.assistant_text}
              </div>
            </div>
          )}

          {/* Code Executed */}
          {hasCode && (
            <div>
              <div className="flex items-center gap-1.5 text-[11px] text-blue-400 font-medium mb-1.5">
                <Code2 className="w-3 h-3" />
                <span>Code Executed</span>
              </div>
              <div className="bg-blue-950/20 border border-blue-500/10 rounded-lg p-3 text-xs text-blue-200 font-mono leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap">
                {step.code_executed}
              </div>
            </div>
          )}

          {/* REPL Output */}
          {hasOutput && (
            <div>
              <div className={`flex items-center gap-1.5 text-[11px] font-medium mb-1.5 ${
                isError ? 'text-red-400' : 'text-emerald-400'
              }`}>
                <Terminal className="w-3 h-3" />
                <span>REPL {isError ? 'Error' : 'Output'}</span>
              </div>
              <div className={`rounded-lg p-3 text-xs font-mono leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap ${
                isError
                  ? 'bg-red-950/20 border border-red-500/10 text-red-200'
                  : 'bg-emerald-950/20 border border-emerald-500/10 text-emerald-200'
              }`}>
                {step.repl_output}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------

export default function App() {
  // --- State ---
  const [query, setQuery] = useState('')
  const [contextText, setContextText] = useState('')
  const [fileName, setFileName] = useState('')
  const [file, setFile] = useState(null)

  const [status, setStatus] = useState('idle') // 'idle' | 'running' | 'done' | 'error'
  const [iterations, setIterations] = useState([])
  const [finalResult, setFinalResult] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [startedInfo, setStartedInfo] = useState(null)
  const [elapsed, setElapsed] = useState(0)

  const startTimeRef = useRef(null)
  const timerRef = useRef(null)
  const trajectoryEndRef = useRef(null)
  const abortRef = useRef(null)

  // Auto-scroll trajectory panel to bottom
  const scrollToBottom = useCallback(() => {
    if (trajectoryEndRef.current) {
      trajectoryEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [iterations, scrollToBottom])

  // Timer
  useEffect(() => {
    if (status === 'running') {
      startTimeRef.current = performance.now()
      timerRef.current = setInterval(() => {
        setElapsed((performance.now() - startTimeRef.current) / 1000)
      }, 100)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [status])

  // --- File handling ---
  const handleFileSelect = (e) => {
    const selected = e.target.files?.[0]
    if (!selected) return
    setFile(selected)
    setFileName(selected.name)

    // Also read the text content for preview
    const reader = new FileReader()
    reader.onload = (ev) => {
      setContextText(ev.target.result)
    }
    reader.readAsText(selected)
  }

  const clearFile = () => {
    setFile(null)
    setFileName('')
    setContextText('')
  }

  // --- Reset ---
  const reset = () => {
    if (abortRef.current) abortRef.current.abort()
    setStatus('idle')
    setIterations([])
    setFinalResult(null)
    setErrorMessage('')
    setStartedInfo(null)
    setElapsed(0)
  }

  // --- Submit query ---
  const submitQuery = useCallback(async () => {
    if (!query.trim()) return
    if (status === 'running') return

    // Reset previous run
    setStatus('running')
    setIterations([])
    setFinalResult(null)
    setErrorMessage('')
    setStartedInfo(null)
    setElapsed(0)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const formData = new FormData()
      formData.append('query', query)

      if (file) {
        formData.append('file', file)
      } else if (contextText.trim()) {
        formData.append('context', contextText)
      }

      const response = await fetch('/api/query', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`Server error ${response.status}: ${errText}`)
      }

      // Read SSE stream
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        let currentEvent = ''
        let currentData = ''

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            currentData = line.slice(6)

            try {
              const payload = JSON.parse(currentData)

              if (currentEvent === 'started') {
                setStartedInfo(payload)
              } else if (currentEvent === 'iteration') {
                setIterations((prev) => [...prev, payload])
              } else if (currentEvent === 'final') {
                setFinalResult(payload)
                setStatus('done')
              } else if (currentEvent === 'error') {
                setErrorMessage(payload.message || 'Unknown error')
                setStatus('error')
              }
            } catch {
              // Ignore malformed JSON lines
            }

            currentEvent = ''
            currentData = ''
          }
        }
      }

      // If stream ended without a final event, mark done
      if (status === 'running') {
        setStatus('done')
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setErrorMessage(err.message || 'Connection failed')
        setStatus('error')
      }
    }
  }, [query, contextText, file, status])

  const isRunning = status === 'running'
  const isDone = status === 'done'
  const isError = status === 'error'

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 flex flex-col antialiased">
      <div className="max-w-6xl w-full mx-auto px-6 py-12 sm:py-16 space-y-10">

        {/* ----------------------------------------------------------------
            Header
            ---------------------------------------------------------------- */}
        <header className="text-center max-w-3xl mx-auto flex flex-col items-center">
          <div className="border border-zinc-800 bg-zinc-900/80 text-zinc-400 px-4 py-1.5 rounded-full text-xs font-medium tracking-wide shadow-sm inline-flex items-center gap-2 mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>RLM Inference Engine • Recursive Language Model</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-3">
            RLM Query Interface
          </h1>

          <p className="text-zinc-400 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            Submit a query with large context. The RLM root model decomposes the task,
            executes code in a persistent REPL, and delegates sub-queries to the worker model
            — all streamed live.
          </p>
        </header>

        {/* ----------------------------------------------------------------
            Query Input Section
            ---------------------------------------------------------------- */}
        <section className="max-w-3xl mx-auto space-y-4">

          {/* Query input */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              submitQuery()
            }}
            className="bg-zinc-900/90 border border-zinc-800 focus-within:border-zinc-600 rounded-2xl p-2 pl-5 shadow-2xl flex items-center gap-3 transition-colors"
          >
            <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
            <input
              id="query-input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter your query — e.g. 'Find all facts and summarize them'"
              className="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none font-normal"
              disabled={isRunning}
            />
            <button
              type="submit"
              disabled={isRunning || !query.trim()}
              className="bg-white text-black hover:bg-zinc-200 font-semibold px-5 py-2.5 rounded-xl transition-all shrink-0 text-xs sm:text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Running…</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Run Query</span>
                </>
              )}
            </button>
          </form>

          {/* Context input — textarea + file upload */}
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <Layers className="w-3.5 h-3.5" />
                <span className="font-medium">Context / Document</span>
                <span className="text-zinc-600">(optional — paste text or upload a file)</span>
              </div>

              <div className="flex items-center gap-2">
                {/* File upload button */}
                <label className="bg-zinc-800/60 hover:bg-zinc-700/60 border border-zinc-700/50 text-zinc-300 text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-colors flex items-center gap-1.5">
                  <Upload className="w-3 h-3" />
                  <span>Upload File</span>
                  <input
                    type="file"
                    accept=".txt,.md,.csv,.json,.py,.js,.ts,.html,.xml,.log"
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={isRunning}
                  />
                </label>

                {(contextText || fileName) && (
                  <button
                    onClick={clearFile}
                    className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                    title="Clear context"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* File badge */}
            {fileName && (
              <div className="flex items-center gap-2 bg-zinc-800/40 border border-zinc-700/40 rounded-lg px-3 py-2 text-xs">
                <FileText className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-zinc-300 font-medium">{fileName}</span>
                <span className="text-zinc-500">
                  ({contextText.length.toLocaleString()} chars)
                </span>
              </div>
            )}

            {/* Textarea */}
            <textarea
              id="context-input"
              value={contextText}
              onChange={(e) => {
                setContextText(e.target.value)
                setFileName('')
                setFile(null)
              }}
              placeholder="Paste your document, code, or any large text here..."
              rows={5}
              className="w-full bg-black/30 border border-zinc-800/50 rounded-xl p-4 text-xs text-zinc-300 font-mono leading-relaxed placeholder-zinc-600 focus:outline-none focus:border-zinc-600 resize-y transition-colors"
              disabled={isRunning}
            />

            {contextText && (
              <div className="text-[11px] text-zinc-600 text-right">
                {contextText.length.toLocaleString()} characters loaded
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            {(isDone || isError) && (
              <button
                onClick={reset}
                className="hover:text-zinc-300 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>New Query</span>
              </button>
            )}
            {isRunning && (
              <button
                onClick={() => {
                  if (abortRef.current) abortRef.current.abort()
                  setStatus('error')
                  setErrorMessage('Query cancelled by user')
                }}
                className="hover:text-red-400 transition-colors flex items-center gap-1 cursor-pointer text-zinc-400"
              >
                <X className="w-3 h-3" />
                <span>Cancel</span>
              </button>
            )}
          </div>
        </section>

        {/* ----------------------------------------------------------------
            Results Section
            ---------------------------------------------------------------- */}
        {(isRunning || isDone || isError) && (
          <section className="grid grid-cols-1 lg:grid-cols-5 gap-6">

            {/* Left: Trajectory Panel (3 cols) */}
            <div className="lg:col-span-3 space-y-4">
              {/* Status bar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-2 h-2 rounded-full ${
                    isRunning ? 'bg-emerald-400 animate-pulse' : isDone ? 'bg-emerald-400' : 'bg-red-400'
                  }`} />
                  <span className="text-sm font-medium text-zinc-200">
                    {isRunning ? 'Processing' : isDone ? 'Complete' : 'Error'}
                  </span>
                  {startedInfo && (
                    <span className="text-xs text-zinc-500">
                      • {startedInfo.total_chars?.toLocaleString()} chars loaded
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-zinc-500">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span className="font-mono">{formatElapsed(elapsed)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Cpu className="w-3 h-3" />
                    <span className="font-mono">{iterations.length} iteration{iterations.length !== 1 ? 's' : ''}</span>
                  </div>
                  {finalResult && (
                    <div className="flex items-center gap-1">
                      <Zap className="w-3 h-3 text-purple-400" />
                      <span className="font-mono text-purple-400">
                        {finalResult.total_sub_calls} sub-call{finalResult.total_sub_calls !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Trajectory iterations */}
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {iterations.length === 0 && isRunning && (
                  <div className="flex items-center gap-3 text-zinc-500 text-sm py-8 justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                    <span>Waiting for root model response…</span>
                  </div>
                )}
                {iterations.map((step, idx) => (
                  <IterationCard
                    key={step.iteration}
                    step={step}
                    isLatest={idx === iterations.length - 1 && isRunning}
                  />
                ))}
                <div ref={trajectoryEndRef} />
              </div>
            </div>

            {/* Right: Final Answer + Stats (2 cols) */}
            <div className="lg:col-span-2 space-y-4">

              {/* Final Answer Card */}
              <div className={`p-6 rounded-2xl border transition-all duration-500 ${
                finalResult
                  ? 'border-emerald-500/30 bg-emerald-950/10'
                  : isError
                  ? 'border-red-500/30 bg-red-950/10'
                  : 'border-zinc-800/80 bg-zinc-900/30'
              }`}>
                <div className="flex items-center gap-2 mb-4">
                  {finalResult ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : isError ? (
                    <AlertCircle className="w-4 h-4 text-red-400" />
                  ) : (
                    <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />
                  )}
                  <span className={`text-sm font-medium ${
                    finalResult ? 'text-emerald-300' : isError ? 'text-red-300' : 'text-zinc-400'
                  }`}>
                    {finalResult ? 'Final Answer' : isError ? 'Error' : 'Awaiting answer…'}
                  </span>
                </div>

                {finalResult && (
                  <div className="bg-black/40 border border-zinc-800/50 rounded-xl p-4 text-sm text-zinc-200 leading-relaxed max-h-80 overflow-y-auto whitespace-pre-wrap font-mono">
                    {finalResult.answer}
                  </div>
                )}

                {isError && (
                  <div className="bg-red-950/30 border border-red-500/10 rounded-xl p-4 text-xs text-red-200 leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap font-mono">
                    {errorMessage}
                  </div>
                )}

                {isRunning && !finalResult && (
                  <div className="text-xs text-zinc-600 italic">
                    The root model is analysing your context through iterative REPL execution…
                  </div>
                )}
              </div>

              {/* Stats Card */}
              {(isDone || iterations.length > 0) && (
                <div className="p-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/30 space-y-4">
                  <div className="text-xs text-zinc-500 font-medium">Run Statistics</div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-zinc-800/30 border border-zinc-800/40 rounded-xl p-3">
                      <div className="text-2xl font-semibold text-white font-mono">
                        {formatElapsed(elapsed)}
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-1">Total Time</div>
                    </div>

                    <div className="bg-zinc-800/30 border border-zinc-800/40 rounded-xl p-3">
                      <div className="text-2xl font-semibold text-white font-mono">
                        {iterations.length}
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-1">Iterations</div>
                    </div>

                    <div className="bg-zinc-800/30 border border-zinc-800/40 rounded-xl p-3">
                      <div className="text-2xl font-semibold text-purple-400 font-mono">
                        {finalResult?.total_sub_calls ?? iterations.reduce((a, s) => a + (s.sub_call_count || 0), 0)}
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-1">Worker Sub-Calls</div>
                    </div>

                    <div className="bg-zinc-800/30 border border-zinc-800/40 rounded-xl p-3">
                      <div className="text-2xl font-semibold font-mono">
                        {finalResult?.terminated ? (
                          <span className="text-emerald-400">✓</span>
                        ) : isDone ? (
                          <span className="text-amber-400">⚠</span>
                        ) : (
                          <span className="text-zinc-500">…</span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-1">
                        {finalResult?.terminated ? 'Terminated' : isDone ? 'Max Iters' : 'Running'}
                      </div>
                    </div>
                  </div>

                  {startedInfo && (
                    <div className="text-[11px] text-zinc-600 border-t border-zinc-800/40 pt-3 space-y-1">
                      <div>Context: {startedInfo.total_chars?.toLocaleString()} characters</div>
                      <div>Max iterations: {startedInfo.max_iterations}</div>
                    </div>
                  )}
                </div>
              )}

              {/* How it works card */}
              <div className="p-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/30">
                <div className="text-xs text-zinc-500 font-medium mb-3">How RLM Works</div>
                <div className="space-y-2 text-[11px] text-zinc-500 leading-relaxed">
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-400 font-mono shrink-0">1.</span>
                    <span>Your large context is stored as a variable in a persistent Python REPL — <em>not</em> injected into the LLM prompt.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-400 font-mono shrink-0">2.</span>
                    <span>The root model writes Python code to slice, search, and analyse the context through the REPL.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-400 font-mono shrink-0">3.</span>
                    <span>It delegates semantic tasks to a fast worker model via <code className="text-zinc-400">llm_query()</code>.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-400 font-mono shrink-0">4.</span>
                    <span>The loop continues until the root model signals a final answer.</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ----------------------------------------------------------------
            Footer
            ---------------------------------------------------------------- */}
        <footer className="pt-8 border-t border-zinc-900 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-600 gap-4">
          <div>RLM Inference Engine • Recursive Language Model Harness</div>
          <div className="flex items-center gap-1">
            <span>Built with Vite + React + FastAPI</span>
            <span>•</span>
            <span>arXiv:2512.24601</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
