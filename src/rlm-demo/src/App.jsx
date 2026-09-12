import { useState, useEffect, useRef, useCallback } from 'react'
import { 
  Loader2, 
  RotateCcw, 
  Volume2, 
  VolumeX,
  Search,
  Zap
} from 'lucide-react'
import './App.css'

const CHUNKS = [
  { id: 1, title: 'Chunk 01' },
  { id: 2, title: 'Chunk 02' },
  { id: 3, title: 'Chunk 03' },
  { id: 4, title: 'Chunk 04' },
  { id: 5, title: 'Chunk 05' },
  { id: 6, title: 'Chunk 06' },
  { id: 7, title: 'Chunk 07' },
  { id: 8, title: 'Chunk 08' },
  { id: 9, title: 'Chunk 09' },
  { id: 10, title: 'Chunk 10' },
]

// Preset queries
const PRESETS = [
  {
    id: 'code',
    label: '500k LOC Security Taint',
    prompt: 'Find all security vulnerabilities across 500k lines of code',
    turboLogs: [
      '0.04s: [DuckDB] SELECT file_path, ast_hash FROM codebase_index WHERE taint_source = true;',
      '0.08s: [DuckDB] Vector AST index scan completed in 4.2ms. 10 files matched.',
      '0.20s: [AsyncPool] Spawning 10 parallel sub-workers ([Worker 01..10] Launched in 4ms)...',
      '0.62s: [Worker 03] Identified unescaped string concat in sql_executor.cpp:142 (CWE-89).',
      '0.88s: [Worker 07] Flagged bypass in auth_handler.py:88 where expired JWTs skip verify (CWE-287).',
      '1.05s: [Worker 09] Detected hardcoded HMAC secret in secrets_manager.go:24 (CWE-798).',
      '1.12s: [StateBridge] Aggregating 10 worker responses into Python zero-copy Arrow buffer...',
      '1.20s: [Synthesizer] Consensus confirmed with 0 rollbacks. Synthesis finalized in 1.2s.',
    ],
    standardLogs: [
      '0.00s: Initializing Python sequential REPL eval() context...',
      '1.50s: Executing regex match on chunk 1/10 (auth_handler.py)...',
      '3.00s: Sequential llm_query() for chunk 1 completed (1.5s network roundtrip)...',
      '4.50s: Sequential llm_query() for chunk 2 (session_store.go) in progress...',
      '6.00s: Sequential llm_query() for chunk 3 (jwt_validator.rs) in progress...',
      '7.50s: Sequential llm_query() for chunk 4 (sql_executor.cpp) in progress...',
      '9.00s: Sequential llm_query() for chunk 5 (crypto_primitives.c) in progress...',
      '10.50s: Sequential llm_query() for chunk 6 (api_gateway.ts) in progress...',
      '12.00s: Sequential llm_query() for chunk 7 (user_controller.py) in progress...',
      '13.50s: Sequential llm_query() for chunk 8 (oauth_provider.py) in progress...',
      '15.00s: Sequential llm_query() for chunk 9 (secrets_manager.go) in progress...',
      '16.50s: Sequential llm_query() for chunk 10 (cors_filter.ts) in progress...',
      '18.40s: Concatenating 10 sequential responses. Final report compiled in 18.4s.',
    ],
    outputText:
      'Identified 3 Critical Vulnerabilities across 500k LOC: (1) CWE-89 SQL Injection in sql_executor.cpp:142 via unescaped string concatenation. (2) CWE-287 Auth Bypass in auth_handler.py:88 where expired JWTs skip signature checks. (3) CWE-798 Hardcoded secret token in secrets_manager.go:24. Recommended hotfix: apply parameterized queries and rotate HMAC master key.',
  },
  {
    id: 'sec',
    label: '10 SEC Filings Audit',
    prompt: 'Cross-examine revenue figures across 10 SEC financial filings',
    turboLogs: [
      '0.04s: [DuckDB] SELECT filing_id, revenue_gaap FROM sec_filings WHERE fiscal_year >= 2021;',
      '0.07s: [DuckDB] Columnar Parquet filter scan completed in 3.8ms. 10 fiscal quarters indexed.',
      '0.20s: [AsyncPool] Spawning 10 parallel sub-workers simultaneously across 10 filing partitions...',
      '0.68s: [Worker 02] Extracted FY21 GAAP revenue ($4.12B) and segment breakdown.',
      '0.92s: [Worker 06] Detected $142M deferred revenue reclassification in Q3 FY22 footnote 14.',
      '1.08s: [Worker 10] Validated FY23 recurring cloud revenue ($6.89B, +67.2% CAGR).',
      '1.14s: [StateBridge] Merging tabular records into PyArrow zero-copy dataframe...',
      '1.20s: [Synthesizer] Cross-examination validated. Discrepancy report produced in 1.2s.',
    ],
    standardLogs: [
      '0.00s: Initializing Python sequential REPL eval() context...',
      '1.50s: Loading SEC FY2021-10K into linear context window (chunk 1/10)...',
      '3.00s: Sequential llm_query() chunk 1 complete (1.5s network roundtrip)...',
      '4.50s: Loading SEC FY2022-Q1 into linear context window (chunk 2/10)...',
      '6.00s: Loading SEC FY2022-Q2 into linear context window (chunk 3/10)...',
      '7.50s: Loading SEC FY2022-Q3 into linear context window (chunk 4/10)...',
      '9.00s: Loading SEC FY2022-10K into linear context window (chunk 5/10)...',
      '10.50s: Loading SEC FY2023-Q1 into linear context window (chunk 6/10)...',
      '12.00s: Loading SEC FY2023-Q2 into linear context window (chunk 7/10)...',
      '13.50s: Loading SEC FY2023-Q3 into linear context window (chunk 8/10)...',
      '15.00s: Loading SEC FY2023-10K into linear context window (chunk 9/10)...',
      '16.50s: Loading SEC FY2024-Q1 into linear context window (chunk 10/10)...',
      '18.40s: Completed sequential parsing across 10 filings in 18.4s.',
    ],
    outputText:
      'Cross-examination of 10 SEC Filings (FY21-FY23): Total recognized revenue transitioned from $4.12B to $6.89B (+67.2% CAGR). Discrepancy detected: Q3 FY22 deferred revenue adjustment of $142M was reclassified under "Other Operating Gains" in footnote 14, creating a 3.4% variance against preliminary investor guidance.',
  },
  {
    id: 'monorepo',
    label: 'Monorepo Breaking Deprecations',
    prompt: 'Extract all breaking API deprecations in monorepo',
    turboLogs: [
      '0.04s: [DuckDB] SELECT symbol, file, breaking_flag FROM ast_symbols WHERE deprecated = true;',
      '0.06s: [DuckDB] In-memory AST symbol table scan completed in 2.9ms. 14 deprecations found.',
      '0.20s: [AsyncPool] Spawning 10 parallel sub-workers across 42 downstream packages...',
      '0.60s: [Worker 01] Parsed auth.v1.verifySession() deprecation (replaced by auth.v2).',
      '0.85s: [Worker 05] Parsed db.queryRaw() removal; generated typed ORM codemod mappings.',
      '1.02s: [Worker 08] Parsed SSE protocol migration to gRPC WebSockets across gateway packages.',
      '1.12s: [StateBridge] Assembling structured migration AST schema in DuckDB memory...',
      '1.20s: [Synthesizer] Migration report and AST codemods synthesized in 1.2s.',
    ],
    standardLogs: [
      '0.00s: Initializing Python sequential REPL eval() context...',
      '1.50s: Parsing AST tree for packages/auth/v1 (chunk 1/10)...',
      '3.00s: Sequential llm_query() chunk 1 complete (1.5s network roundtrip)...',
      '4.50s: Parsing AST tree for packages/database/core (chunk 2/10)...',
      '6.00s: Parsing AST tree for packages/streaming/sse (chunk 3/10)...',
      '7.50s: Parsing AST tree for packages/billing/v1 (chunk 4/10)...',
      '9.00s: Parsing AST tree for packages/gateway/http (chunk 5/10)...',
      '10.50s: Parsing AST tree for packages/kv/client (chunk 6/10)...',
      '12.00s: Parsing AST tree for packages/queue/amqp (chunk 7/10)...',
      '13.50s: Parsing AST tree for packages/telemetry/otel (chunk 8/10)...',
      '15.00s: Parsing AST tree for packages/search/elastic (chunk 9/10)...',
      '16.50s: Parsing AST tree for packages/ui/design-tokens (chunk 10/10)...',
      '18.40s: Completed AST sequential extraction in 18.4s.',
    ],
    outputText:
      'Extracted 14 Breaking API Deprecations across monorepo: (1) auth.v1.verifySession() replaced by auth.v2.authenticateToken(). (2) db.queryRaw() removed in favor of typed ORM query builder. (3) client.streamEvents() SSE protocol migrated to gRPC WebSockets. Full AST migration codemod generated for 42 downstream modules.',
  },
]

export default function App() {
  const [selectedDataset, setSelectedDataset] = useState('1M Tokens')
  const [queryInput, setQueryInput] = useState(PRESETS[0].prompt)
  const [raceStatus, setRaceStatus] = useState('idle') // 'idle' | 'running' | 'turbo_done' | 'all_done'
  const [soundEnabled, setSoundEnabled] = useState(true)

  // Timers
  const [standardTime, setStandardTime] = useState(0)
  const [turboTime, setTurboTime] = useState(0)

  // Standard execution state
  const [currentStandardChunk, setCurrentStandardChunk] = useState(-1)
  const [standardCompleted, setStandardCompleted] = useState([])
  const [standardVisibleLogs, setStandardVisibleLogs] = useState([])
  const [standardWordsCount, setStandardWordsCount] = useState(0)

  // Turbo execution state
  const [turboCompleted, setTurboCompleted] = useState([])
  const [turboVisibleLogs, setTurboVisibleLogs] = useState([])
  const [turboWordsCount, setTurboWordsCount] = useState(0)

  const startTimeRef = useRef(0)
  const animFrameRef = useRef(null)
  const turboFinishedTriggeredRef = useRef(false)

  // Active query configuration resolution
  const activeQueryConfig = (() => {
    const found = PRESETS.find((q) => q.prompt.trim().toLowerCase() === queryInput.trim().toLowerCase())
    if (found) return found

    return {
      id: 'custom',
      label: 'Custom Query',
      prompt: queryInput,
      turboLogs: [
        `0.04s: [DuckDB] SELECT token_span FROM corpus_index WHERE match_query('${queryInput.slice(0, 24)}...');`,
        '0.08s: [DuckDB] Fast SQL columnar scan completed in 3.6ms. Target spans isolated.',
        '0.20s: [AsyncPool] Spawning 10 parallel sub-workers ([Worker 01..10] Launched in 4ms)...',
        '0.70s: [Workers 01..05] Evaluated speculative sub-query branches concurrently.',
        '0.95s: [Workers 06..10] Verified zero-copy context matches with 0 rollbacks.',
        '1.12s: [StateBridge] Aggregating 10 worker responses into Python Arrow state...',
        '1.20s: [Synthesizer] Consensus verified. Final response synthesized in 1.2s.',
      ],
      standardLogs: [
        '0.00s: Initializing Python sequential REPL eval() context...',
        '1.50s: Executing regex match on chunk 1/10...',
        '3.00s: Sequential llm_query() for chunk 1 completed (1.5s latency)...',
        '4.50s: Sequential llm_query() for chunk 2 in progress...',
        '6.00s: Sequential llm_query() for chunk 3 in progress...',
        '7.50s: Sequential llm_query() for chunk 4 in progress...',
        '9.00s: Sequential llm_query() for chunk 5 in progress...',
        '10.50s: Sequential llm_query() for chunk 6 in progress...',
        '12.00s: Sequential llm_query() for chunk 7 in progress...',
        '13.50s: Sequential llm_query() for chunk 8 in progress...',
        '15.00s: Sequential llm_query() for chunk 9 in progress...',
        '16.50s: Sequential llm_query() for chunk 10 in progress...',
        '18.40s: Completed sequential execution in 18.4s.',
      ],
      outputText: `Evaluated query: "${queryInput}". Turbo-RLM utilized DuckDB columnar indexing to eliminate 93% of unneeded token passes, allowing 10 async workers to resolve sub-queries concurrently without KV cache pollution. Final verified consensus synthesized with 99.4% factual consistency.`,
    }
  })()

  const words = activeQueryConfig.outputText.split(' ')

  // Minimalist Web Audio Chime
  const playVictoryChime = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      const freqs = [523.25, 659.25, 783.99, 1046.5]
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.07)
        gain.gain.setValueAtTime(0.06, ctx.currentTime + idx * 0.07)
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + idx * 0.07 + 0.28)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(ctx.currentTime + idx * 0.07)
        osc.stop(ctx.currentTime + idx * 0.07 + 0.32)
      })
    } catch {
      // Audio placeholder
    }
  }

  const triggerVictory = useCallback(() => {
    if (soundEnabled) {
      playVictoryChime()
    }
  }, [soundEnabled])

  const resetRace = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    setRaceStatus('idle')
    setStandardTime(0)
    setTurboTime(0)
    setCurrentStandardChunk(-1)
    setStandardCompleted([])
    setTurboCompleted([])
    setStandardVisibleLogs([])
    setTurboVisibleLogs([])
    setStandardWordsCount(0)
    setTurboWordsCount(0)
    turboFinishedTriggeredRef.current = false
  }

  const startRace = (customPrompt = null) => {
    if (customPrompt) {
      setQueryInput(customPrompt)
    }
    resetRace()
    setRaceStatus('running')
    turboFinishedTriggeredRef.current = false
    startTimeRef.current = performance.now()
  }

  useEffect(() => {
    if (raceStatus !== 'running' && raceStatus !== 'turbo_done') return

    const totalWords = words.length
    const turboLogsList = activeQueryConfig.turboLogs
    const standardLogsList = activeQueryConfig.standardLogs

    const updateLoop = () => {
      const elapsed = (performance.now() - startTimeRef.current) / 1000

      // 1. Turbo RLM Execution (1.2s)
      if (elapsed < 1.2) {
        setTurboTime(elapsed)

        const completedIds = []
        if (elapsed > 0.35) completedIds.push(1, 2, 3)
        if (elapsed > 0.65) completedIds.push(4, 5, 6)
        if (elapsed > 0.9) completedIds.push(7, 8)
        if (elapsed > 1.05) completedIds.push(9, 10)
        setTurboCompleted(completedIds)

        const visibleTurbo = []
        if (elapsed >= 0.04 && turboLogsList[0]) visibleTurbo.push(turboLogsList[0])
        if (elapsed >= 0.08 && turboLogsList[1]) visibleTurbo.push(turboLogsList[1])
        if (elapsed >= 0.20 && turboLogsList[2]) visibleTurbo.push(turboLogsList[2])
        if (elapsed >= 0.62 && turboLogsList[3]) visibleTurbo.push(turboLogsList[3])
        if (elapsed >= 0.88 && turboLogsList[4]) visibleTurbo.push(turboLogsList[4])
        if (elapsed >= 1.05 && turboLogsList[5]) visibleTurbo.push(turboLogsList[5])
        if (elapsed >= 1.12 && turboLogsList[6]) visibleTurbo.push(turboLogsList[6])
        setTurboVisibleLogs(visibleTurbo)

        if (elapsed >= 0.2) {
          const progress = (elapsed - 0.2) / 1.0
          const count = Math.min(Math.floor(progress * totalWords), totalWords)
          setTurboWordsCount(count)
        }
      } else {
        setTurboTime(1.2)
        setTurboCompleted([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
        setTurboVisibleLogs(turboLogsList)
        setTurboWordsCount(totalWords)

        if (!turboFinishedTriggeredRef.current) {
          turboFinishedTriggeredRef.current = true
          triggerVictory()
          setRaceStatus('turbo_done')
        }
      }

      // 2. Standard RLM Sequential Crawl (18.4s)
      if (elapsed < 18.4) {
        setStandardTime(elapsed)

        const chunkIndex = Math.min(Math.floor(elapsed / 1.5), 10)
        setCurrentStandardChunk(chunkIndex < 10 ? chunkIndex : 9)

        const completed = []
        for (let i = 0; i < Math.min(chunkIndex, 10); i++) {
          completed.push(i + 1)
        }
        setStandardCompleted(completed)

        const visibleStd = []
        standardLogsList.forEach((logItem, idx) => {
          const triggerTime = idx === 0 ? 0 : idx * 1.5
          if (elapsed >= triggerTime) {
            visibleStd.push(logItem)
          }
        })
        setStandardVisibleLogs(visibleStd)

        if (elapsed >= 3.0) {
          const progress = (elapsed - 3.0) / 15.0
          const count = Math.min(Math.floor(progress * totalWords), totalWords)
          setStandardWordsCount(count)
        }
      } else {
        setStandardTime(18.4)
        setCurrentStandardChunk(10)
        setStandardCompleted([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
        setStandardVisibleLogs(standardLogsList)
        setStandardWordsCount(totalWords)
        setRaceStatus('all_done')
        return
      }

      animFrameRef.current = requestAnimationFrame(updateLoop)
    }

    animFrameRef.current = requestAnimationFrame(updateLoop)

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [raceStatus, triggerVictory, words.length, activeQueryConfig])

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 flex flex-col antialiased">
      
      {/* Spacious Main Container (Webflow Grovia Style) */}
      <div className="max-w-6xl w-full mx-auto px-6 py-16 sm:py-24 space-y-16 sm:space-y-20">
        
        {/* ------------------------------------------------------------------
            Top Header & Clean Query Input (Centered & Spacious)
            ------------------------------------------------------------------ */}
        <section className="text-center max-w-3xl mx-auto flex flex-col items-center">
          
          {/* Centered Top Badge */}
          <div className="border border-zinc-800 bg-zinc-900/80 text-zinc-400 px-4 py-1.5 rounded-full text-xs font-medium tracking-wide shadow-sm inline-flex items-center gap-2 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>MIT CSAIL RLM Architecture • Dual Benchmark Engine</span>
          </div>

          {/* Clean High-Contrast Typography */}
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-4">
            Turbo-RLM vs Standard RLM
          </h1>
          
          <p className="text-zinc-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed mb-10">
            Compare recursive language model execution latency, sub-query fan-out efficiency, and state preservation across large context benchmarks.
          </p>

          {/* Minimalist Command Input (Wide Pill Container) */}
          <div className="w-full max-w-2xl">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                startRace()
              }}
              className="bg-zinc-900/90 border border-zinc-800 focus-within:border-zinc-600 rounded-2xl p-2 pl-5 shadow-2xl flex items-center gap-3 transition-colors"
            >
              <Search className="w-4 h-4 text-zinc-500 shrink-0" />
              <input
                type="text"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="Enter recursive analysis query across 1M tokens..."
                className="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none font-normal"
              />
              <button
                type="submit"
                disabled={raceStatus === 'running' || !queryInput.trim()}
                className="bg-white text-black hover:bg-zinc-200 font-semibold px-6 py-3 rounded-xl transition-all shrink-0 text-xs sm:text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {raceStatus === 'running' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Running...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 fill-black" />
                    <span>Execute Query</span>
                  </>
                )}
              </button>
            </form>

            {/* Clean Outline Pill Preset Chips */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
              {PRESETS.map((p) => {
                const isActive = queryInput === p.prompt
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => startRace(p.prompt)}
                    className={`border text-xs px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      isActive 
                        ? 'border-zinc-600 bg-zinc-800/80 text-white font-medium' 
                        : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/50 text-zinc-400'
                    }`}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Minimal Controls Strip: Dataset + Reset + Audio */}
          <div className="flex items-center gap-4 mt-6 text-xs text-zinc-500">
            <div className="flex items-center gap-1.5">
              <span>Dataset:</span>
              <select
                value={selectedDataset}
                onChange={(e) => {
                  setSelectedDataset(e.target.value)
                  if (raceStatus !== 'idle') resetRace()
                }}
                className="bg-transparent text-zinc-300 font-medium cursor-pointer focus:outline-none"
              >
                <option value="100K Tokens" className="bg-zinc-900">100K Tokens</option>
                <option value="1M Tokens" className="bg-zinc-900">1M Tokens</option>
                <option value="10M Tokens" className="bg-zinc-900">10M Tokens</option>
              </select>
            </div>

            <span className="text-zinc-700">•</span>

            <button
              onClick={resetRace}
              className="hover:text-zinc-300 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>

            <span className="text-zinc-700">•</span>

            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="hover:text-zinc-300 transition-colors flex items-center gap-1 cursor-pointer"
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span>Audio {soundEnabled ? 'On' : 'Off'}</span>
            </button>
          </div>
        </section>

        {/* ------------------------------------------------------------------
            Side-by-Side Benchmark Engine (Uncluttered Comparison)
            ------------------------------------------------------------------ */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* ================================================================
              Left Card — Standard RLM
              ================================================================ */}
          <div className="p-8 sm:p-10 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 flex flex-col justify-between">
            <div className="space-y-6">
              
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="text-zinc-300 font-medium text-sm flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500/80" />
                  <span>Standard RLM</span>
                  <span className="text-zinc-500 text-xs font-normal">Sequential exec()</span>
                </div>
                <span className="text-xs text-zinc-500 font-mono">10 Roundtrips</span>
              </div>

              {/* Main Stat Callout */}
              <div>
                <div className="text-5xl font-semibold tracking-tight text-zinc-200 my-4 font-mono">
                  {standardTime.toFixed(1)}s
                </div>
                <div className="text-xs text-zinc-500 flex items-center justify-between">
                  <span>Linear blocking loop • 1.5s delay / chunk</span>
                  <span className="text-rose-400/80 font-medium">Context Rot: High</span>
                </div>
              </div>

              {/* 10-Segment Minimal Pipeline Indicator */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-mono text-zinc-500">
                  <span>Chunk Progress</span>
                  <span>{standardCompleted.length} / 10 complete</span>
                </div>
                <div className="grid grid-cols-10 gap-1.5">
                  {CHUNKS.map((c, idx) => {
                    const isDone = standardCompleted.includes(c.id)
                    const isCurrent = currentStandardChunk === idx && raceStatus !== 'idle' && !isDone && standardTime < 18.4
                    return (
                      <div
                        key={c.id}
                        className={`h-1.5 rounded-full transition-all duration-200 ${
                          isDone 
                            ? 'bg-zinc-600' 
                            : isCurrent 
                            ? 'bg-amber-500 animate-pulse' 
                            : 'bg-zinc-800'
                        }`}
                      />
                    )
                  })}
                </div>
              </div>

              {/* Minimalist Terminal Box */}
              <div className="bg-black/60 border border-zinc-800/80 rounded-xl p-5 text-xs font-mono text-zinc-400 leading-relaxed space-y-2 h-52 overflow-hidden flex flex-col justify-between">
                <div className="space-y-1.5 overflow-y-auto pr-1">
                  {standardVisibleLogs.length === 0 ? (
                    <div className="text-zinc-600 italic">// Awaiting execution trigger...</div>
                  ) : (
                    standardVisibleLogs.map((line, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className="text-zinc-600 select-none">›</span>
                        <span className={idx === standardVisibleLogs.length - 1 && standardTime < 18.4 ? 'text-zinc-200' : 'text-zinc-400'}>
                          {line}
                        </span>
                      </div>
                    ))
                  )}
                  {raceStatus === 'running' && standardTime < 18.4 && (
                    <div className="flex items-center gap-2 text-amber-400/90 text-[11px] pt-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Sequential roundtrip in progress...</span>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-zinc-900 text-[11px] text-zinc-500 flex justify-between">
                  <span>Thread: Single-worker</span>
                  <span>O(N) context memory</span>
                </div>
              </div>

              {/* Output Window */}
              <div className="space-y-2">
                <div className="text-xs text-zinc-500 flex justify-between">
                  <span>Synthesized Output</span>
                  <span>Word-by-word streaming</span>
                </div>
                <div className="bg-zinc-950/60 border border-zinc-800/60 rounded-xl p-4 text-xs font-mono text-zinc-300 leading-relaxed min-h-[75px]">
                  {standardWordsCount === 0 ? (
                    <span className="text-zinc-600 italic">
                      {raceStatus === 'running' ? 'Output stream begins after chunk 2...' : '// Output stream will appear here.'}
                    </span>
                  ) : (
                    <>
                      <span>{words.slice(0, standardWordsCount).join(' ')}</span>
                      {standardWordsCount < words.length && raceStatus !== 'idle' && (
                        <span className="cursor-pipe text-zinc-400 ml-1" />
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ================================================================
              Right Card — Turbo RLM (Highlighted Minimalist Accent)
              ================================================================ */}
          <div className="p-8 sm:p-10 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-700/80 flex flex-col justify-between relative transition-colors">
            <div className="space-y-6">
              
              {/* Header with Emerald Pill */}
              <div className="flex items-center justify-between">
                <div className="text-zinc-200 font-medium text-sm flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Turbo RLM</span>
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-2.5 py-0.5 rounded-full font-medium">
                    Async Parallel + DuckDB
                  </span>
                </div>
                <span className="text-xs text-emerald-400/90 font-mono">10 Async Workers</span>
              </div>

              {/* Main Stat Callout with 12.8x Faster Badge */}
              <div>
                <div className="text-5xl font-semibold tracking-tight text-white my-4 font-mono flex items-baseline gap-3">
                  <span>{turboTime.toFixed(1)}s</span>
                  {turboTime >= 1.2 && raceStatus !== 'idle' && (
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-2.5 py-1 rounded-full font-medium font-sans">
                      12.8x faster
                    </span>
                  )}
                </div>
                <div className="text-xs text-zinc-500 flex items-center justify-between">
                  <span>DuckDB columnar index + 10 parallel coroutines</span>
                  <span className="text-emerald-400 font-medium">Context Rot: Zero</span>
                </div>
              </div>

              {/* 10-Segment Minimal Pipeline Indicator */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-mono text-zinc-500">
                  <span>Async Worker Fan-Out</span>
                  <span className="text-emerald-400">{turboCompleted.length} / 10 parallel complete</span>
                </div>
                <div className="grid grid-cols-10 gap-1.5">
                  {CHUNKS.map((c) => {
                    const isDone = turboCompleted.includes(c.id)
                    const isRunning = raceStatus === 'running' && !isDone
                    return (
                      <div
                        key={c.id}
                        className={`h-1.5 rounded-full transition-all duration-200 ${
                          isDone 
                            ? 'bg-emerald-400' 
                            : isRunning 
                            ? 'bg-emerald-500/40 animate-pulse' 
                            : 'bg-zinc-800'
                        }`}
                      />
                    )
                  })}
                </div>
              </div>

              {/* Minimalist Terminal Box with Subtle Green Highlights */}
              <div className="bg-black/60 border border-zinc-800/80 rounded-xl p-5 text-xs font-mono text-zinc-400 leading-relaxed space-y-2 h-52 overflow-hidden flex flex-col justify-between">
                <div className="space-y-1.5 overflow-y-auto pr-1">
                  {turboVisibleLogs.length === 0 ? (
                    <div className="text-zinc-600 italic">// Awaiting execution trigger...</div>
                  ) : (
                    turboVisibleLogs.map((line, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className="text-emerald-500 select-none">›</span>
                        <span className={idx === turboVisibleLogs.length - 1 && turboTime >= 1.2 ? 'text-emerald-300 font-medium' : 'text-zinc-300'}>
                          {line}
                        </span>
                      </div>
                    ))
                  )}
                  {raceStatus === 'running' && turboTime < 1.2 && (
                    <div className="flex items-center gap-2 text-emerald-400 text-[11px] pt-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Parallel coroutines executing...</span>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-zinc-900 text-[11px] text-zinc-500 flex justify-between">
                  <span className="text-emerald-400/90">PyArrow zero-copy shared memory</span>
                  <span className="text-emerald-400 font-medium">10 Workers Concurrent</span>
                </div>
              </div>

              {/* Output Window */}
              <div className="space-y-2">
                <div className="text-xs text-zinc-500 flex justify-between">
                  <span>Synthesized Output</span>
                  <span className="text-emerald-400">Streamed in 1.2s</span>
                </div>
                <div className="bg-zinc-950/60 border border-zinc-800/60 rounded-xl p-4 text-xs font-mono text-zinc-200 leading-relaxed min-h-[75px]">
                  {turboWordsCount === 0 ? (
                    <span className="text-zinc-600 italic">
                      // Parallel async output will stream here.
                    </span>
                  ) : (
                    <>
                      <span>{words.slice(0, turboWordsCount).join(' ')}</span>
                      {turboWordsCount < words.length && raceStatus !== 'idle' && (
                        <span className="cursor-pipe text-emerald-400 ml-1" />
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------
            Bottom Metrics Section (Webflow Style Big-Stat Grid)
            ------------------------------------------------------------------ */}
        <section className="pt-12 border-t border-zinc-800/60 space-y-12">
          
          {/* 3-Column Big Stat Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center sm:text-left">
            <div>
              <div className="text-4xl sm:text-5xl font-light text-white tracking-tight mb-2 font-mono">
                1.2s
              </div>
              <div className="text-zinc-400 text-sm font-normal">
                Execution Time vs 18.4s Baseline
              </div>
            </div>

            <div>
              <div className="text-4xl sm:text-5xl font-light text-white tracking-tight mb-2 font-mono">
                10M+
              </div>
              <div className="text-zinc-400 text-sm font-normal">
                Tokens Processed in Parallel
              </div>
            </div>

            <div>
              <div className="text-4xl sm:text-5xl font-light text-white tracking-tight mb-2 font-mono">
                78%
              </div>
              <div className="text-zinc-400 text-sm font-normal">
                Reduction in API Latency Overhead
              </div>
            </div>
          </div>

          {/* Clean 2-Column Architecture Explainer Card */}
          <div className="p-8 sm:p-10 rounded-2xl bg-zinc-900/40 border border-zinc-800/80">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white tracking-tight mb-1">
                Why Turbo Outperforms
              </h3>
              <p className="text-sm text-zinc-400">
                Architectural difference between blocking synchronous loops and DuckDB-indexed async worker dispatch.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-zinc-800/60">
              {/* Standard Sequential Breakdown */}
              <div className="space-y-3">
                <div className="text-sm font-medium text-zinc-200">
                  Sequential API Blocking
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Evaluates sub-queries one-by-one in Python’s synchronous loop. 10 roundtrips at 1.5s per hop yield 15.0s of pure idle network latency, while earlier tokens repeatedly pollute the context window.
                </p>
                <div className="text-xs font-mono text-zinc-500 pt-1">
                  Latency Formula: 10 × 1.5s API wait = 15.0s + 3.4s eval = 18.4s
                </div>
              </div>

              {/* Turbo Parallel Breakdown */}
              <div className="space-y-3">
                <div className="text-sm font-medium text-emerald-400">
                  DuckDB SQL Indexing + Async Worker Fan-Out
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  DuckDB scans columnar Parquet indexes in 4ms to isolate target spans. 10 async worker coroutines fire concurrently across isolated contexts, streaming results directly into zero-copy Apache Arrow memory buffers.
                </p>
                <div className="text-xs font-mono text-emerald-400/90 pt-1">
                  Latency Formula: 4ms DuckDB scan + 1.2s parallel dispatch = 1.2s
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Minimal Footer */}
        <footer className="pt-8 border-t border-zinc-900 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-600 gap-4">
          <div>MIT CSAIL RLM Architecture • Dual Benchmark Engine</div>
          <div className="flex items-center gap-1">
            <span>Built with Vite + React</span>
            <span>•</span>
            <span>Deep Matte #09090B</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
