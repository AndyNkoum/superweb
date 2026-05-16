import React, { useEffect, useRef, useState } from 'react';
import './App.css';

// --- ANDY'S ADVANCED DFT ALGORITHM ---
// Upgraded to map negative frequencies. This makes half the epicycles 
// orbit counter-clockwise, creating an incredibly complex mechanical aesthetic.
function dft(points) {
    const X = [];
    const N = points.length;

    for (let k = 0; k < N; k++) {
        let re = 0; let im = 0;
        for (let n = 0; n < N; n++) {
            const phi = (2 * Math.PI * k * n) / N;
            re += points[n].x * Math.cos(phi) + points[n].y * Math.sin(phi);
            im += points[n].y * Math.cos(phi) - points[n].x * Math.sin(phi);
        }
        re /= N; im /= N;

        // The Genius Fix: Animate negative frequencies backward
        let freq = k > N / 2 ? k - N : k;

        X[k] = { freq, amp: Math.sqrt(re * re + im * im), phase: Math.atan2(im, re) };
    }
    return X;
}

// Resamples and links multiple strokes into one continuous mathematical loop
function interpolateStrokes(strokes, spacing = 2) {
    let path = [];
    if (strokes.length === 0) return path;

    for (let i = 0; i < strokes.length; i++) {
        const currentStroke = strokes[i];

        // Add current stroke
        for (let j = 0; j < currentStroke.length - 1; j++) {
            const p1 = currentStroke[j];
            const p2 = currentStroke[j + 1];
            const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            const steps = Math.max(1, Math.floor(dist / spacing));
            for (let s = 0; s < steps; s++) {
                path.push({
                    x: p1.x + (p2.x - p1.x) * (s / steps),
                    y: p1.y + (p2.y - p1.y) * (s / steps),
                });
            }
        }

        // Invisible Jump Line to next stroke (or back to start)
        const endPoint = currentStroke[currentStroke.length - 1];
        const nextStroke = strokes[(i + 1) % strokes.length];
        const nextStart = nextStroke[0];

        const jumpDist = Math.hypot(nextStart.x - endPoint.x, nextStart.y - endPoint.y);
        const jumpSteps = Math.max(1, Math.floor(jumpDist / spacing));
        for (let s = 0; s < jumpSteps; s++) {
            path.push({
                x: endPoint.x + (nextStart.x - endPoint.x) * (s / jumpSteps),
                y: endPoint.y + (nextStart.y - endPoint.y) * (s / jumpSteps),
            });
        }
    }
    return path;
}

export default function FourierEngine() {
    const canvasRef = useRef(null);

    // UI States
    const [mode, setMode] = useState('WAITING'); // WAITING, DRAWING, READY, ORBITING
    const [epicycleCount, setEpicycleCount] = useState(0);
    const [maxEpicycles, setMaxEpicycles] = useState(1);
    const [showDocs, setShowDocs] = useState(false);

    // Physics / Math Memory
    const stateRef = useRef({
        strokes: [], // Array of individual strokes
        currentStroke: [],
        fourierData: [],
        reconstructedPath: [],
        time: 0,
        isDrawing: false,
        cx: 0, cy: 0
    });

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { alpha: false });
        let frameId;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            stateRef.current.cx = canvas.width / 2;
            stateRef.current.cy = canvas.height / 2;
        };
        window.addEventListener('resize', resize);
        resize();

        const drawGrid = () => {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
            ctx.lineWidth = 1;
            const cx = stateRef.current.cx;
            const cy = stateRef.current.cy;

            // Polar/Radar Grid
            for (let r = 50; r < 2000; r += 100) {
                ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
            }
            ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(canvas.width, cy); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, canvas.height); ctx.stroke();
        };

        const render = () => {
            const state = stateRef.current;

            // Clear Void
            ctx.fillStyle = '#020204';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            drawGrid();

            // --- DRAWING MODE ---
            if (mode === 'WAITING' || mode === 'DRAWING' || mode === 'READY') {
                ctx.strokeStyle = 'rgba(0, 240, 255, 0.5)';
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';

                // Draw all completed strokes
                state.strokes.forEach(stroke => {
                    if (stroke.length < 2) return;
                    ctx.beginPath();
                    ctx.moveTo(stroke[0].x + state.cx, stroke[0].y + state.cy);
                    for (let i = 1; i < stroke.length; i++) {
                        ctx.lineTo(stroke[i].x + state.cx, stroke[i].y + state.cy);
                    }
                    ctx.stroke();
                });

                // Draw current active stroke
                if (state.currentStroke.length > 0) {
                    ctx.beginPath();
                    ctx.strokeStyle = '#00f0ff';
                    ctx.moveTo(state.currentStroke[0].x + state.cx, state.currentStroke[0].y + state.cy);
                    for (let i = 1; i < state.currentStroke.length; i++) {
                        ctx.lineTo(state.currentStroke[i].x + state.cx, state.currentStroke[i].y + state.cy);
                    }
                    ctx.stroke();
                }
            }

            // --- ORBITING MODE (THE OP AESTHETIC) ---
            if (mode === 'ORBITING' && state.fourierData.length > 0) {
                let x = state.cx;
                let y = state.cy;

                for (let i = 0; i < epicycleCount; i++) {
                    let prevX = x;
                    let prevY = y;
                    let f = state.fourierData[i];
                    let radius = f.amp;
                    let angle = f.freq * state.time + f.phase;

                    x += radius * Math.cos(angle);
                    y += radius * Math.sin(angle);

                    // Faint Ghost Rings
                    ctx.beginPath();
                    ctx.arc(prevX, prevY, radius, 0, Math.PI * 2);
                    ctx.strokeStyle = 'rgba(100, 150, 255, 0.08)';
                    ctx.lineWidth = 1;
                    ctx.stroke();

                    // Glowing Vector Radii
                    ctx.beginPath();
                    ctx.moveTo(prevX, prevY);
                    ctx.lineTo(x, y);
                    ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
                    ctx.stroke();

                    // Joint dots
                    ctx.beginPath();
                    ctx.arc(x, y, 1.5, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                    ctx.fill();
                }

                state.reconstructedPath.unshift({ x, y });
                if (state.reconstructedPath.length > state.fourierData.length * 1.5) {
                    state.reconstructedPath.pop();
                }

                // The Neon Trace
                ctx.beginPath();
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.strokeStyle = '#ff003c';
                ctx.lineWidth = 3;
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#ff003c';

                for (let i = 0; i < state.reconstructedPath.length; i++) {
                    const pt = state.reconstructedPath[i];
                    if (i === 0) ctx.moveTo(pt.x, pt.y);
                    else ctx.lineTo(pt.x, pt.y);
                }
                ctx.stroke();
                ctx.shadowBlur = 0;

                const dt = (Math.PI * 2) / state.fourierData.length;
                state.time += dt;
                if (state.time > Math.PI * 2) {
                    state.time = 0;
                    state.reconstructedPath = [];
                }
            }

            frameId = requestAnimationFrame(render);
        };

        render();
        return () => {
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(frameId);
        };
    }, [mode, epicycleCount]);

    // --- GLOBAL POINTER EVENTS (Unbreakable Drawing) ---
    useEffect(() => {
        const handleMove = (e) => {
            const state = stateRef.current;
            if (state.isDrawing) {
                const last = state.currentStroke[state.currentStroke.length - 1];
                const dx = (e.clientX - state.cx) - last.x;
                const dy = (e.clientY - state.cy) - last.y;
                if (dx * dx + dy * dy > 9) { // 3px threshold
                    state.currentStroke.push({ x: e.clientX - state.cx, y: e.clientY - state.cy });
                }
            }
        };

        const handleUp = () => {
            const state = stateRef.current;
            if (state.isDrawing) {
                state.isDrawing = false;
                if (state.currentStroke.length > 2) {
                    state.strokes.push([...state.currentStroke]);
                }
                state.currentStroke = [];
                if (state.strokes.length > 0) setMode('READY');
            }
        };

        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', handleUp);

        return () => {
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup', handleUp);
        };
    }, []);

    const handlePointerDown = (e) => {
        if (showDocs || mode === 'ORBITING') return;
        const state = stateRef.current;
        state.isDrawing = true;
        state.currentStroke = [{ x: e.clientX - state.cx, y: e.clientY - state.cy }];
        setMode('DRAWING');
    };

    const handleRun = () => {
        const state = stateRef.current;
        if (state.strokes.length === 0) return;

        // 1. Weave all strokes into one continuous path with invisible jump lines
        const continuousPath = interpolateStrokes(state.strokes, 3);

        // 2. Downsample slightly if path is massive to prevent CPU lockup
        const downsampled = continuousPath.filter((_, i) => i % 2 === 0);

        // 3. RUN ANDY'S MATH
        let fourier = dft(downsampled);

        // Sort by amplitude (Largest circles in the center)
        fourier.sort((a, b) => b.amp - a.amp);

        state.fourierData = fourier;
        state.time = 0;
        state.reconstructedPath = [];
        setMaxEpicycles(fourier.length);

        // Use up to 300 epicycles for that crazy mechanical look, but default to max if less
        setEpicycleCount(Math.min(fourier.length, 300));
        setMode('ORBITING');
    };

    const clearCanvas = () => {
        stateRef.current.strokes = [];
        stateRef.current.currentStroke = [];
        stateRef.current.fourierData = [];
        stateRef.current.reconstructedPath = [];
        setMode('WAITING');
    };

    return (
        <div className="app-container">
            <canvas
                ref={canvasRef}
                className="fourier-canvas"
                onPointerDown={handlePointerDown}
            />

            {/* Futuristic HUD */}
            <div className="hud-panel" onPointerDown={e => e.stopPropagation()}>
                <div className="status-indicator">
                    <span className="status-label">SYS_STATE</span>
                    <span className="status-value">{mode}</span>
                </div>

                <div className="control-slider" style={{ opacity: mode === 'ORBITING' ? 1 : 0.3, pointerEvents: mode === 'ORBITING' ? 'auto' : 'none' }}>
                    <div className="slider-header">
                        <span>Active Harmonics</span>
                        <span>{epicycleCount} / {maxEpicycles}</span>
                    </div>
                    <input
                        type="range"
                        min="1"
                        max={maxEpicycles}
                        value={epicycleCount}
                        onChange={(e) => setEpicycleCount(parseInt(e.target.value))}
                        className="slider"
                    />
                </div>

                <div className="btn-group">
                    <button className="btn" onClick={clearCanvas}>CLEAR</button>
                    {mode !== 'ORBITING' ? (
                        <button className="btn btn-run" onClick={handleRun}>RUN ENGINE</button>
                    ) : (
                        <button className="btn btn-run" onClick={clearCanvas}>STOP</button>
                    )}
                    <button className="btn btn-andy" onClick={() => setShowDocs(true)}>ANDY'S CODE</button>
                </div>
            </div>

            {/* Andy's Code Modal */}
            <div className={`modal-overlay ${showDocs ? 'active' : ''}`}>
                <div className="modal-content">
                    <h2 className="modal-title">Andy's Epicycle Engine</h2>
                    <div className="modal-body">
                        
                        <p>
                            When you draw multiple separate lines, the engine automatically calculates invisible "jump vectors" to weave your strokes into a single continuous mathematical loop. It then runs the <strong>Discrete Fourier Transform</strong>, routing frequencies backward ($k - N$) to make the mechanical arms orbit in both directions simultaneously.
                        </p>

                        <pre className="code-block">
                            {`// DFT ALGO inspire by tung tung tung
function dft(points) {
  const X = [];
  const N = points.length;
  
  for (let k = 0; k < N; k++) {
    let re = 0; let im = 0;
    
    // Euler's Integration
    for (let n = 0; n < N; n++) {
      const phi = (2 * Math.PI * k * n) / N;
      re += points[n].x * Math.cos(phi) + points[n].y * Math.sin(phi);
      im += points[n].y * Math.cos(phi) - points[n].x * Math.sin(phi);
    }
    
    re /= N; im /= N;
    
    // Map negative frequencies backward so 
    // circles spin clockwise AND counter-clockwise
    let freq = k > N / 2 ? k - N : k; 
    
    X[k] = { 
      freq: freq, 
      amp: Math.sqrt(re*re + im*im), 
      phase: Math.atan2(im, re) 
    };
  }
  return X;
}`}
                        </pre>
                        <p style={{ marginTop: '1rem', fontStyle: 'italic', fontSize: '0.8rem', color: '#64748b' }}>
                            Draw anything. Lift your mouse as many times as you want. Click RUN. The math will figure out the rest.
                        </p>
                    </div>
                    <button className="btn-close" onClick={() => setShowDocs(false)}>ACKNOWLEDGE</button>
                </div>
            </div>
        </div>
    );
}