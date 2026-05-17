import React, { useEffect, useRef, useState } from 'react';
import './App.css';

// --- THE MASTER ALGORITHM: DISCRETE FOURIER TRANSFORM ---
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

export default function AndyFullEngine() {
  const canvasRef = useRef(null);
  const [mode, setMode] = useState('DRAWING');
  const [showDocs, setShowDocs] = useState(false);
  const [penColor, setPenColor] = useState('#00f0ff');
  const [animSpeed, setAnimSpeed] = useState(1);
  const [fadeSpeed, setFadeSpeed] = useState(1);

  const stateRef = useRef({
    strokes: [], currentStroke: [], fourierData: [], reconstructedPath: [],
    time: 0, cx: 0, cy: 0
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let frameId;

    const resize = () => {
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
        ctx.strokeStyle = penColor;
        ctx.lineWidth = 2;
        state.strokes.concat([state.currentStroke]).forEach(s => {
          if (s.length < 2) return;
          ctx.beginPath();
          ctx.moveTo(s[0].x + state.cx, s[0].y + state.cy);
          s.forEach(p => ctx.lineTo(p.x + state.cx, p.y + state.cy));
          ctx.stroke();
        });
      }

      if (mode === 'ORBITING') {
        let x = state.cx; let y = state.cy;
        
        // --- UPGRADED GEAR VISUALS ---
        for (let i = 0; i < state.fourierData.length; i++) {
          const f = state.fourierData[i];
          const prevX = x; const prevY = y;
          const angle = f.freq * state.time + f.phase;
          x += f.amp * Math.cos(angle);
          y += f.amp * Math.sin(angle);

          if (i < 100) { // Increased to 100 visible gears
            // 1. The Orbiting Rings (Brighter with a cyan tint)
            ctx.beginPath(); 
            ctx.arc(prevX, prevY, f.amp, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)'; // Much more visible
            ctx.lineWidth = 1;
            ctx.stroke();
            
            // 2. The Connecting Mechanical Arms (Solid bright white)
            ctx.beginPath(); 
            ctx.moveTo(prevX, prevY); 
            ctx.lineTo(x, y);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'; // Brighter
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // 3. The Gear Joints (Adds a mechanical dot at each connection)
            ctx.beginPath();
            ctx.arc(x, y, 1.5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fill();
          }
        }

        state.reconstructedPath.unshift({ x, y });
        const maxLen = state.fourierData.length * (2 / fadeSpeed);
        if (state.reconstructedPath.length > maxLen) state.reconstructedPath.pop();

        // The Glowing Neon Trace
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        
        state.reconstructedPath.forEach((p, i) => {
          ctx.globalAlpha = 1 - (i / state.reconstructedPath.length);
          ctx.strokeStyle = penColor;
          ctx.beginPath();
          if (i === 0) ctx.moveTo(p.x, p.y); 
          else { ctx.moveTo(state.reconstructedPath[i-1].x, state.reconstructedPath[i-1].y); ctx.lineTo(p.x, p.y); }
          ctx.stroke();
        });
        
        ctx.globalAlpha = 1.0;
        state.time += ((Math.PI * 2) / state.fourierData.length) * animSpeed;
      }
      frameId = requestAnimationFrame(render);
    };

    render();
    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(frameId); };
  }, [mode, penColor, animSpeed, fadeSpeed]);

  const onPointerDown = (e) => {
    if (mode === 'ORBITING' || e.target.closest('.hud-panel')) return;
    const canvas = canvasRef.current;
    canvas.setPointerCapture(e.pointerId);
    stateRef.current.currentStroke = [{ x: e.clientX - stateRef.current.cx, y: e.clientY - stateRef.current.cy }];
  };

  const onPointerMove = (e) => {
    if (canvasRef.current?.hasPointerCapture(e.pointerId)) {
      stateRef.current.currentStroke.push({ x: e.clientX - stateRef.current.cx, y: e.clientY - stateRef.current.cy });
    }
  };

  const onPointerUp = (e) => {
    canvasRef.current?.releasePointerCapture(e.pointerId);
    if (stateRef.current.currentStroke.length > 2) stateRef.current.strokes.push([...stateRef.current.currentStroke]);
    stateRef.current.currentStroke = [];
  };

  const handleRun = () => {
    const state = stateRef.current;
    if (state.strokes.length === 0) return;
    let path = [];
    state.strokes.forEach((s, idx) => {
      path = path.concat(s);
      const next = state.strokes[(idx + 1) % state.strokes.length][0];
      const last = s[s.length - 1];
      for (let i = 1; i <= 5; i++) path.push({ x: last.x + (next.x - last.x) * (i / 5), y: last.y + (next.y - last.y) * (i / 5) });
    });
    state.fourierData = dft(path).sort((a, b) => b.amp - a.amp);
    state.time = 0; state.reconstructedPath = []; setMode('ORBITING');
  };

  return (
    <div className="app-container">
      <canvas ref={canvasRef} className="fourier-canvas" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} />
      <div className="hud-panel">
        <div className="controls-grid">
          <div className="control-item"><label>Pen Color</label><input type="color" value={penColor} onChange={e => setPenColor(e.target.value)} /></div>
          <div className="control-item"><label>Draw Speed</label><input type="range" min="0.1" max="3" step="0.1" value={animSpeed} onChange={e => setAnimSpeed(parseFloat(e.target.value))} /></div>
          <div className="control-item"><label>Ink Fade</label><input type="range" min="0.2" max="2" step="0.1" value={fadeSpeed} onChange={e => setFadeSpeed(parseFloat(e.target.value))} /></div>
          <div className="control-item" style={{justifyContent: 'center'}}><button className="btn btn-andy" onClick={() => setShowDocs(true)}>Andy's Code</button></div>
        </div>
        <div className="btn-group">
          <button className="btn" onClick={() => { stateRef.current.strokes = []; stateRef.current.reconstructedPath = []; setMode('DRAWING'); }}>Clear</button>
          <button className="btn btn-run" onClick={handleRun}>Run Engine</button>
        </div>
      </div>

      <div className={`modal-overlay ${showDocs ? 'active' : ''}`} onClick={() => setShowDocs(false)}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <h2>The Fourier Architecture</h2>
          <p>The system uses a <strong>Discrete Fourier Transform (DFT)</strong> to map spatial temporal points into the complex frequency domain.</p>
          
          <h3>1. Signal Decomposition</h3>
          <pre className="code-block">
{`// Transforms spatial (x,y) into frequency components
function dft(points) {
  // ... loop k frequencies through n points
  const phi = (2 * PI * k * n) / N;
  re += x * cos(phi) + y * sin(phi);
  im += y * cos(phi) - x * sin(phi);
  // Amplitude: Strength of the circle
  // Phase: Starting angle of the circle
}`}
          </pre>

          <h3>2. Multi-Stroke Interpolation</h3>
          <p>Disjointed paths are woven into a single periodic loop by calculating "null-space vectors" between the end of stroke <em>n</em> and the start of stroke <em>n+1</em>.</p>

          <h3>3. Temporal Decay & Memory</h3>
          <pre className="code-block">
{`// Maintains a 'Health' for every rendered point
state.reconstructedPath.unshift({ x, y });
if (path.length > maxLen) path.pop();

// Rendering with Alpha Gradient
ctx.globalAlpha = 1 - (index / totalPoints);`}
          </pre>
          <button className="btn" style={{marginTop: '1rem'}} onClick={() => setShowDocs(false)}>Close</button>
        </div>
      </div>
    </div>
  );
}