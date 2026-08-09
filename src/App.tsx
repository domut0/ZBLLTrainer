import { useState, useEffect } from 'react'

export default function App() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [interactionCount, setInteractionCount] = useState(0)

  useEffect(() => {
    // Listen for the PWA install prompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }

    // Check if the app is already installed/running as standalone
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         (window.navigator as any).standalone === true

    setIsInstalled(isStandalone)

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    
    // Listen for successful installation
    const handleAppInstalled = () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
      console.log('Lock In was successfully installed.')
    }
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setDeferredPrompt(null)
      setIsInstalled(true)
    }
  }

  // Unit isometric vectors for the cube representation
  const C = { x: 100, y: 112.4 }
  const ur = { x: 26.8, y: -15.4 }
  const ul = { x: -26.8, y: -15.4 }
  const dn = { x: 0, y: 31.0 }

  const getPointsString = (p0: {x:number, y:number}, p1: {x:number, y:number}, p2: {x:number, y:number}, p3: {x:number, y:number}) => {
    return `${p0.x},${p0.y} ${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`
  }

  // Modern, vibrant Rubik's cube color palettes for dark mode
  const colors = {
    yellow: ['#f59e0b', '#fbbf24', '#fcd34d'], // Gold / Yellow
    blue: ['#2563eb', '#3b82f6', '#60a5fa'],   // Electric Blue
    red: ['#dc2626', '#ef4444', '#f87171'],    // Ruby Red
    green: ['#16a34a', '#22c55e', '#4ade80'],  // Emerald Green
    orange: ['#ea580c', '#f97316', '#fb923c'], // Tangerine Orange
    white: ['#d4d4d8', '#e4e4e7', '#f4f4f5']   // Silver / White
  }

  // We can cycle colors on click/tap for a fun interactive feel!
  const colorCycles = [
    // Standard ZBLL top cross/F2L look
    { top: colors.yellow[1], left: colors.blue[1], right: colors.red[1] },
    { top: colors.green[1], left: colors.orange[1], right: colors.white[1] },
    { top: colors.blue[1], left: colors.red[1], right: colors.yellow[1] },
    { top: colors.orange[1], left: colors.green[1], right: colors.white[1] }
  ]

  const activeColors = colorCycles[interactionCount % colorCycles.length]

  return (
    <div className="flex-1 flex flex-col justify-between items-center px-6 py-12 select-none relative overflow-hidden bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950">
      
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-purple-600/10 blur-[80px] pointer-events-none animate-pulse-slow" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-64 h-64 rounded-full bg-blue-600/10 blur-[80px] pointer-events-none animate-pulse-slow" />

      {/* Top section: Brand/Status */}
      <div className="w-full text-center mt-4 z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900/60 backdrop-blur-md text-xs font-medium text-zinc-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
          <span>V1.0.0 • Offline Ready</span>
        </div>
      </div>

      {/* Main Interactive visual */}
      <div className="flex-1 flex flex-col justify-center items-center gap-8 z-10 w-full max-w-sm">
        
        {/* Animated Cube Graphic */}
        <div 
          onClick={() => setInteractionCount(prev => prev + 1)}
          className="relative cursor-pointer transition-transform duration-500 active:scale-95 hover:scale-105 active:rotate-3"
          title="Tap to spin cube colors"
        >
          {/* External soft glow */}
          <div className="absolute inset-0 rounded-full bg-purple-500/5 blur-xl transition-all duration-300" />
          
          <svg 
            viewBox="0 0 200 220" 
            className="w-48 h-48 drop-shadow-[0_8px_24px_rgba(168,85,247,0.15)] animate-float"
          >
            {/* Render 3x3 Isometric Rubik's Cube */}
            
            {/* Top Face (Yellow) */}
            {Array.from({ length: 3 }).map((_, i) => 
              Array.from({ length: 3 }).map((_, j) => {
                const p0 = {
                  x: C.x + i * ur.x + j * ul.x,
                  y: C.y + i * ur.y + j * ul.y
                }
                const p1 = { x: p0.x + ur.x, y: p0.y + ur.y }
                const p2 = { x: p0.x + ur.x + ul.x, y: p0.y + ur.y + ul.y }
                const p3 = { x: p0.x + ul.x, y: p0.y + ul.y }
                
                // Highlight the center sticker slightly or make a ZBLL-like cross
                const isCenter = i === 1 && j === 1
                const fillColor = isCenter ? colors.yellow[0] : activeColors.top

                return (
                  <polygon
                    key={`top-${i}-${j}`}
                    points={getPointsString(p0, p1, p2, p3)}
                    fill={fillColor}
                    stroke="#09090b"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                    className="transition-colors duration-500"
                  />
                )
              })
            )}

            {/* Left Face (Blue) */}
            {Array.from({ length: 3 }).map((_, j) => 
              Array.from({ length: 3 }).map((_, k) => {
                const p0 = {
                  x: C.x + j * ul.x + k * dn.x,
                  y: C.y + j * ul.y + k * dn.y
                }
                const p1 = { x: p0.x + ul.x, y: p0.y + ul.y }
                const p2 = { x: p0.x + ul.x + dn.x, y: p0.y + ul.y + dn.y }
                const p3 = { x: p0.x + dn.x, y: p0.y + dn.y }

                const isCenter = j === 1 && k === 1
                const fillColor = isCenter ? colors.blue[0] : activeColors.left

                return (
                  <polygon
                    key={`left-${j}-${k}`}
                    points={getPointsString(p0, p1, p2, p3)}
                    fill={fillColor}
                    stroke="#09090b"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                    className="transition-colors duration-500"
                  />
                )
              })
            )}

            {/* Right Face (Red) */}
            {Array.from({ length: 3 }).map((_, i) => 
              Array.from({ length: 3 }).map((_, k) => {
                const p0 = {
                  x: C.x + i * ur.x + k * dn.x,
                  y: C.y + i * ur.y + k * dn.y
                }
                const p1 = { x: p0.x + ur.x, y: p0.y + ur.y }
                const p2 = { x: p0.x + ur.x + dn.x, y: p0.y + ur.y + dn.y }
                const p3 = { x: p0.x + dn.x, y: p0.y + dn.y }

                const isCenter = i === 1 && k === 1
                const fillColor = isCenter ? colors.red[0] : activeColors.right

                return (
                  <polygon
                    key={`right-${i}-${k}`}
                    points={getPointsString(p0, p1, p2, p3)}
                    fill={fillColor}
                    stroke="#09090b"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                    className="transition-colors duration-500"
                  />
                )
              })
            )}
          </svg>
        </div>

        {/* Branding Title */}
        <div className="text-center space-y-2 select-none">
          <h1 className="text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-100 via-zinc-300 to-zinc-400 drop-shadow-md">
            Lock In
          </h1>
          <p className="text-sm font-semibold tracking-widest text-zinc-500 uppercase">
            ZBLL Trainer
          </p>
        </div>
      </div>

      {/* Bottom section: PWA install button & info */}
      <div className="w-full max-w-xs flex flex-col items-center gap-4 z-10 mb-4">
        {deferredPrompt && !isInstalled ? (
          <button
            onClick={handleInstallClick}
            className="w-full py-4 px-6 rounded-2xl font-semibold text-zinc-950 bg-gradient-to-r from-purple-400 via-pink-400 to-amber-300 hover:opacity-95 active:scale-[0.98] transition-all duration-200 shadow-[0_4px_20px_rgba(236,72,153,0.3)]"
          >
            Install App
          </button>
        ) : (
          <div className="w-full text-center py-4 text-xs font-semibold text-zinc-500 bg-zinc-900/40 border border-zinc-800/40 rounded-2xl backdrop-blur-sm">
            {isInstalled ? 'Running Standalone Mode' : 'Add to Home Screen for Offline Training'}
          </div>
        )}
        
        <p className="text-[10px] text-zinc-600 text-center uppercase tracking-wider">
          Tap the cube to scramble
        </p>
      </div>

    </div>
  )
}
