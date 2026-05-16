import React, { useEffect, useRef, useState } from 'react';
import './App.css';

// --- ANDY'S MOBILE-STABLE DFT ---
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
        let freq = k > N / 2 ? k - N : k;
        X[k] = { freq, amp: Math.sqrt(re * re + im * im), phase: Math.atan2(im, re) };
    }
    return X;
}

export default function MobileFourierEngine() {
    const canvasRef = useRef(null);
    const [mode, setMode] = useState('DRAWING'); // DRAWING, ORBITING
    const [showDocs, setShowDocs] = useState(false);
    const [epicycles, setEpicycles] = useState(100);

    const stateRef = useRef({
        strokes: [], currentStroke: [],
        fourierData: [], reconstructedPath: [],
        time: 0, cx: 0, cy: 0
    });

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let frameId;

        const resize = () => {
            // Handle High DPI screens (Retina)
            const dpr = window.devicePixelRatio || 1;
            canvas.width = window.innerWidth * dpr;
            canvas.height = window.innerHeight * dpr;
            ctx.scale(dpr, dpr);
            stateRef.current.cx = window.innerWidth / 2;
            stateRef.current.cy = window.innerHeight / 2;
        };
        window.addEventListener('resize', resize);
        resize();

        const render = () => {
            const state = stateRef.current;
            ctx.fillStyle = '#020204';
            ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

            if (mode === 'DRAWING') {
                ctx.strokeStyle = '#00f0ff';
                ctx.lineWidth = 2;
                // Previous strokes
                state.strokes.forEach(s => {
                    ctx.beginPath();
                    ctx.moveTo(s[0].x + state.cx, s[0].y + state.cy);
                    s.forEach(p => ctx.lineTo(p.x + state.cx, p.y + state.cy));
                    ctx.stroke();
                });
                // Current stroke
                if (state.currentStroke.length > 1) {
                    ctx.beginPath();
                    ctx.moveTo(state.currentStroke[0].x + state.cx, state.currentStroke[0].y + state.cy);
                    state.currentStroke.forEach(p => ctx.lineTo(p.x + state.cx, p.y + state.cy));
                    ctx.stroke();
                }
            }

            if (mode === 'ORBITING') {
                let x = state.cx; let y = state.cy;
                const count = Math.min(state.fourierData.length, epicycles);

                for (let i = 0; i < count; i++) {
                    const f = state.fourierData[i];
                    const prevX = x; const prevY = y;
                    const angle = f.freq * state.time + f.phase;
                    x += f.amp * Math.cos(angle);
                    y += f.amp * Math.sin(angle);

                    ctx.beginPath();
                    ctx.arc(prevX, prevY, f.amp, 0, Math.PI * 2);
                    ctx.strokeStyle = 'rgba(0, 240, 255, 0.1)';
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.moveTo(prevX, prevY); ctx.lineTo(x, y);
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                    ctx.stroke();
                }

                state.reconstructedPath.unshift({ x, y });
                ctx.beginPath();
                ctx.strokeStyle = '#ff003c';
                ctx.lineWidth = 3;
                state.reconstructedPath.forEach((p, i) => {
                    if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
                });
                ctx.stroke();

                const dt = (Math.PI * 2) / state.fourierData.length;
                state.time += dt;
                if (state.reconstructedPath.length > state.fourierData.length) state.reconstructedPath.pop();
            }
            frameId = requestAnimationFrame(render);
        };

        render();
        return () => {
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(frameId);
        };
    }, [mode, epicycles]);

    // --- MOBILE STABLE POINTER EVENTS ---
    const onPointerDown = (e) => {
        if (mode === 'ORBITING') return;
        const canvas = canvasRef.current;
        canvas.setPointerCapture(e.pointerId); // Essential for mobile stability
        const state = stateRef.current;
        state.currentStroke = [{ x: e.clientX - state.cx, y: e.clientY - state.cy }];
    };

    const onPointerMove = (e) => {
        const state = stateRef.current;
        if (canvasRef.current.hasPointerCapture(e.pointerId)) {
            state.currentStroke.push({ x: e.clientX - state.cx, y: e.clientY - state.cy });
        }
    };

    const onPointerUp = (e) => {
        const canvas = canvasRef.current;
        if (canvas.hasPointerCapture(e.pointerId)) {
            canvas.releasePointerCapture(e.pointerId);
            const state = stateRef.current;
            if (state.currentStroke.length > 2) {
                state.strokes.push([...state.currentStroke]);
            }
            state.currentStroke = [];
        }
    };

    const handleRun = () => {
        const state = stateRef.current;
        if (state.strokes.length === 0) return;

        // Flatten and interpolate jump lines
        let fullPath = [];
        state.strokes.forEach((s, idx) => {
            fullPath = fullPath.concat(s);
            // Interpolate to next stroke start
            const next = state.strokes[(idx + 1) % state.strokes.length][0];
            const last = s[s.length - 1];
            for (let i = 1; i <= 10; i++) {
                fullPath.push({
                    x: last.x + (next.x - last.x) * (i / 10),
                    y: last.y + (next.y - last.y) * (i / 10)
                });
            }
        });

        state.fourierData = dft(fullPath).sort((a, b) => b.amp - a.amp);
        state.time = 0;
        state.reconstructedPath = [];
        setMode('ORBITING');
    };

    return (
        <div className="app-container">
            <canvas
                ref={canvasRef}
                className="fourier-canvas"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
            />

            <div className="hud-panel">
                <div className="btn-group">
                    <button className="btn" onClick={() => { stateRef.current.strokes = []; setMode('DRAWING'); }}>Clear</button>
                    {mode === 'DRAWING' ? (
                        <button className="btn btn-run" onClick={handleRun}>Run</button>
                    ) : (
                        <button className="btn btn-run" onClick={() => setMode('DRAWING')}>Edit</button>
                    )}
                    <button className="btn btn-andy" onClick={() => setShowDocs(true)}>Andy's Code</button>
                </div>
                {mode === 'ORBITING' && (
                    <input type="range" className="slider" min="1" max={stateRef.current.fourierData.length} value={epicycles} onChange={(e) => setEpicycles(e.target.value)} />
                )}
            </div>

            <div className={`modal-overlay ${showDocs ? 'active' : ''}`} onClick={() => setShowDocs(false)}>
                <div className="modal-content">
                    <h2>Andy's Mobile Engine</h2>
                    <pre className="code-block">
                        {`// Mobile Optimized Pointer Capture
canvas.setPointerCapture(e.pointerId);

// The Core DFT
for (let k = 0; k < N; k++) {
  // ... Complex Math ...
  let freq = k > N / 2 ? k - N : k;
}`}
                    </pre>
                    <button className="btn" style={{ marginTop: '1rem' }}>Close</button>
                </div>
            </div>
        </div>
    );
}