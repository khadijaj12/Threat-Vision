import { useState, useEffect, useRef, useCallback } from "react";

// ── Config ────────────────────────────────────────────────────────────────
// Change this to your deployed server URL
const API_BASE = "https://threatvision-gpu.loca.lt";
const WS_URL = "wss://threatvision-gpu.loca.lt/stream";

// ── Add bypass header to all fetch calls ─────────────────────────────────
const apiFetch = (url, options = {}) => fetch(url, {
  ...options,
  headers: {
    ...options.headers,
    "bypass-tunnel-reminder": "true",
    "ngrok-skip-browser-warning": "true",
  }
});
// ── Hooks ─────────────────────────────────────────────────────────────────
const useWebcam = () => {
  const videoRef = useRef(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState(null);
  const streamRef = useRef(null);

  const start = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, frameRate: 15 } });
      streamRef.current = s;
      if (videoRef.current) videoRef.current.srcObject = s;
      setActive(true); setError(null);
    } catch (e) { setError(e.message); }
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
  }, []);

  return { videoRef, active, error, start, stop };
};

// ── Components ────────────────────────────────────────────────────────────
const StatusBadge = ({ label, value, color = "#00d4ff", pulse = false }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 20px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, minWidth: 90 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
      {pulse && <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, boxShadow: `0 0 8px ${color}`, animation: "pulse 1.5s ease infinite" }} />}
      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 18, fontWeight: 800, color }}>{value}</span>
    </div>
    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'Space Mono', monospace" }}>{label}</span>
  </div>
);

const AlertRow = ({ alert }) => (
  <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(255,0,60,0.06)", border: "1px solid rgba(255,0,60,0.18)", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <span style={{ fontSize: 14 }}>⚠</span>
      <div>
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 700, color: "#ff4757" }}>
          {alert.threat_count} INTRUDER{alert.threat_count > 1 ? "S" : ""} DETECTED
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2, fontFamily: "'Space Mono', monospace" }}>
          {new Date(alert.timestamp).toLocaleTimeString()} · {alert.pipeline_ms}ms
        </div>
      </div>
    </div>
    <div style={{ display: "flex", gap: 6 }}>
      {alert.threats.map((t, i) => (
        <span key={i} style={{ padding: "3px 8px", borderRadius: 999, background: "rgba(255,71,87,0.15)", border: "1px solid rgba(255,71,87,0.3)", fontSize: 10, color: "#ff4757", fontFamily: "'Space Mono', monospace", fontWeight: 700 }}>
          {Math.round(t.confidence * 100)}%
        </span>
      ))}
    </div>
  </div>
);

// ── Main Dashboard ────────────────────────────────────────────────────────
export default function ThreatDashboard() {
  const webcam = useWebcam();
  const canvasRef = useRef(null);   // captures frames from video
  const wsRef = useRef(null);
  const intervalRef = useRef(null);

  const [connected, setConnected] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [serverHealth, setServerHealth] = useState(null);
  const [annotatedFrame, setAnnotatedFrame] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState({ fps: 0, latency: 0, threats: 0, frames: 0 });
  const [threatActive, setThreatActive] = useState(false);
  const [cameraId, setCameraId] = useState("cam-01");
  const frameTimeRef = useRef([]);

  // ── Server health poll ──────────────────────────────────────────────────
  useEffect(() => {
    const poll = async () => {
      try {
        const r = await apiFetch(`${API_BASE}/health`);
        const d = await r.json();
        setServerHealth(d);
      } catch { setServerHealth(null); }
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, []);

  // ── Fetch alerts ────────────────────────────────────────────────────────
  const fetchAlerts = useCallback(async () => {
    try {
      const r = await apiFetch(`${API_BASE}/alerts?limit=20`);
      const d = await r.json();
      setAlerts(d.alerts || []);
    } catch { }
  }, []);

  useEffect(() => {
    fetchAlerts();
    const id = setInterval(fetchAlerts, 3000);
    return () => clearInterval(id);
  }, [fetchAlerts]);

  // ── WebSocket connect ────────────────────────────────────────────────────
  const connectWS = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => { setConnected(true); };
    ws.onclose = () => { setConnected(false); setStreaming(false); };
    ws.onerror = () => { setConnected(false); };

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.error) { console.warn("Server error:", data.error); return; }

      // Annotated frame
      if (data.annotated_frame) setAnnotatedFrame(data.annotated_frame);

      // Threat state
      setThreatActive(data.threat_detected);
      if (data.threat_detected) fetchAlerts();

      // Stats
      const now = Date.now();
      frameTimeRef.current.push(now);
      frameTimeRef.current = frameTimeRef.current.filter(t => now - t < 1000);
      setStats(prev => ({
        fps: frameTimeRef.current.length,
        latency: data.pipeline_ms,
        threats: data.threat_detected ? prev.threats + data.threat_count : prev.threats,
        frames: prev.frames + 1,
      }));
    };
  }, [fetchAlerts]);

  // ── Capture + send frames ────────────────────────────────────────────────
  const captureAndSend = useCallback(() => {
    const video = webcam.videoRef.current;
    const canvas = canvasRef.current;
    const ws = wsRef.current;
    if (!video || !canvas || !ws || ws.readyState !== WebSocket.OPEN) return;
    if (video.readyState < 2) return;

    const ctx = canvas.getContext("2d");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    ctx.drawImage(video, 0, 0);

    const b64 = canvas.toDataURL("image/jpeg", 0.75);
    ws.send(JSON.stringify({ frame: b64, camera_id: cameraId }));
  }, [webcam.videoRef, cameraId]);

  // ── Start/stop streaming ─────────────────────────────────────────────────
  const startStream = useCallback(async () => {
    await webcam.start();
    connectWS();
    // Wait for webcam to init
    setTimeout(() => {
      intervalRef.current = setInterval(captureAndSend, 200); // 5fps to server
      setStreaming(true);
    }, 800);
  }, [webcam, connectWS, captureAndSend]);

  const stopStream = useCallback(() => {
    clearInterval(intervalRef.current);
    webcam.stop();
    wsRef.current?.close();
    setStreaming(false);
    setAnnotatedFrame(null);
    setThreatActive(false);
  }, [webcam]);

  // ── Single frame upload test ─────────────────────────────────────────────
  const analyzeFile = useCallback(async (file) => {
    const form = new FormData();
    form.append("file", file);
    form.append("camera_id", cameraId);
    try {
      const r = await apiFetch(`${API_BASE}/analyze/upload`, { method: "POST", body: form });
      if (d.annotated_frame) setAnnotatedFrame(d.annotated_frame);
      setThreatActive(d.threat_detected);
      fetchAlerts();
    } catch (e) { console.error(e); }
  }, [cameraId, fetchAlerts]);

  const serverReady = serverHealth?.status === "ready";

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Serif+Display&display=swap" rel="stylesheet" />
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #020610; color: #fff; font-family: sans-serif; }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(0.7)} }
        @keyframes threatPulse { 0%,100%{box-shadow:0 0 0 0 rgba(255,50,50,0.4)}70%{box-shadow:0 0 0 12px rgba(255,50,50,0)} }
        @keyframes spin { from{transform:rotate(0deg)}to{transform:rotate(360deg)} }
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:#020610} ::-webkit-scrollbar-thumb{background:#333;border-radius:4px}
      `}</style>

      <div style={{ minHeight: "100vh", background: "#020610", display: "flex", flexDirection: "column" }}>

        {/* ── Top bar ─────────────────────────────────────────────────── */}
        <div style={{ padding: "14px 28px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", background: threatActive ? "rgba(255,20,20,0.06)" : "rgba(0,0,0,0.4)", backdropFilter: "blur(10px)", transition: "background 0.5s" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#ff4757,#ff2020)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, boxShadow: "0 0 20px rgba(255,71,87,0.4)" }}>◈</div>
            <div>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 16, fontWeight: 700 }}>ThreatVision</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "'Space Mono', monospace", letterSpacing: "0.06em" }}>YOLOv8 + U-Net · Real-Time Intruder Detection</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {/* Server status */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 999, background: serverReady ? "rgba(0,255,148,0.08)" : "rgba(255,150,0,0.08)", border: `1px solid ${serverReady ? "rgba(0,255,148,0.2)" : "rgba(255,150,0,0.2)"}` }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: serverReady ? "#00ff94" : "#ff9f43", animation: "pulse 2s ease infinite" }} />
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: serverReady ? "#00ff94" : "#ff9f43", fontWeight: 700, letterSpacing: "0.08em" }}>
                {serverHealth === null ? "CONNECTING..." : serverReady ? `SERVER READY · ${serverHealth.device?.toUpperCase()}` : "SERVER LOADING"}
              </span>
            </div>
            {/* WS status */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 999, background: connected ? "rgba(0,212,255,0.08)" : "rgba(255,255,255,0.04)", border: `1px solid ${connected ? "rgba(0,212,255,0.2)" : "rgba(255,255,255,0.08)"}` }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: connected ? "#00d4ff" : "#666" }} />
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: connected ? "#00d4ff" : "#666", fontWeight: 700 }}>{connected ? "WS CONNECTED" : "WS OFF"}</span>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 340px", gap: 0 }}>

          {/* ── Left: Video feed ───────────────────────────────────────── */}
          <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Stats row */}
            <div style={{ display: "flex", gap: 10 }}>
              <StatusBadge label="FPS" value={stats.fps} color="#00d4ff" pulse={streaming} />
              <StatusBadge label="Latency" value={`${stats.latency}ms`} color="#a855f7" />
              <StatusBadge label="Threats" value={stats.threats} color="#ff4757" pulse={threatActive} />
              <StatusBadge label="Frames" value={stats.frames} color="#ffd93d" />
              <div style={{ flex: 1 }} />
              {/* Camera ID input */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "rgba(255,255,255,0.3)" }}>CAMERA ID</span>
                <input value={cameraId} onChange={e => setCameraId(e.target.value)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 10px", color: "#fff", fontFamily: "'Space Mono', monospace", fontSize: 12, width: 100, outline: "none" }} />
              </div>
            </div>

            {/* Video viewport */}
            <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", background: "#000", aspectRatio: "16/9", border: `2px solid ${threatActive ? "rgba(255,50,50,0.6)" : "rgba(255,255,255,0.06)"}`, transition: "border-color 0.3s", animation: threatActive ? "threatPulse 1s ease infinite" : "none" }}>
              {/* Live webcam (hidden when annotated frame available) */}
              <video ref={webcam.videoRef} autoPlay muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", display: annotatedFrame ? "none" : "block" }} />
              {/* Annotated output from server */}
              {annotatedFrame && (
                <img src={annotatedFrame} alt="Annotated" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              )}
              {/* Hidden canvas for frame capture */}
              <canvas ref={canvasRef} style={{ display: "none" }} />

              {/* Idle state */}
              {!streaming && !annotatedFrame && (
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "rgba(255,255,255,0.3)" }}>
                  <div style={{ fontSize: 48 }}>📷</div>
                  <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, letterSpacing: "0.08em" }}>CAMERA OFFLINE</div>
                  <div style={{ fontSize: 12, fontFamily: "'DM Serif Display', serif" }}>Start stream or upload an image below</div>
                </div>
              )}

              {/* THREAT overlay banner */}
              {threatActive && (
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "10px 16px", background: "rgba(255,20,20,0.85)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff", animation: "pulse 0.8s ease infinite" }} />
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, letterSpacing: "0.1em" }}>⚠ INTRUDER DETECTED — U-NET SEGMENTATION ACTIVE</span>
                </div>
              )}

              {/* Streaming badge */}
              {streaming && (
                <div style={{ position: "absolute", bottom: 12, left: 12, display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 999, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff4757", animation: "pulse 1s ease infinite" }} />
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#fff", letterSpacing: "0.08em" }}>LIVE</span>
                </div>
              )}
            </div>

            {/* Controls */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {!streaming ? (
                <button onClick={startStream} disabled={!serverReady} style={{ padding: "12px 28px", borderRadius: 10, background: serverReady ? "linear-gradient(135deg,#00d4ff,#0044ff)" : "rgba(255,255,255,0.06)", border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: serverReady ? "pointer" : "default", fontFamily: "'Space Mono', monospace", letterSpacing: "0.06em", boxShadow: serverReady ? "0 0 30px rgba(0,212,255,0.3)" : "none", transition: "all 0.3s" }}>
                  ▶ Start Live Stream
                </button>
              ) : (
                <button onClick={stopStream} style={{ padding: "12px 28px", borderRadius: 10, background: "rgba(255,71,87,0.15)", border: "1px solid rgba(255,71,87,0.3)", color: "#ff4757", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Space Mono', monospace", letterSpacing: "0.06em", transition: "all 0.2s" }}>
                  ⏹ Stop Stream
                </button>
              )}
              {/* File upload */}
              <label style={{ padding: "12px 28px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Space Mono', monospace", letterSpacing: "0.06em", transition: "all 0.2s" }}>
                📁 Upload Image
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => { if (e.target.files[0]) analyzeFile(e.target.files[0]); }} />
              </label>
              {webcam.error && (
                <span style={{ fontSize: 12, color: "#ff4757", fontFamily: "'Space Mono', monospace", padding: "12px 0" }}>⚠ Camera: {webcam.error}</span>
              )}
            </div>

            {/* Model info */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { label: "Detection", value: "YOLOv8n", sub: "Person / intruder detection", color: "#00d4ff" },
                { label: "Segmentation", value: "U-Net", sub: "ResNet34 encoder · Pixel mask", color: "#a855f7" },
              ].map(m => (
                <div key={m.label} style={{ padding: "14px 18px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: m.color, letterSpacing: "0.12em", marginBottom: 6 }}>{m.label}</div>
                  <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{m.value}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Serif Display', serif" }}>{m.sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: Alert panel ─────────────────────────────────────── */}
          <div style={{ borderLeft: "1px solid rgba(255,255,255,0.06)", padding: 20, display: "flex", flexDirection: "column", gap: 16, overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 700, color: "#ff4757", letterSpacing: "0.1em" }}>ALERT LOG</div>
              <button onClick={async () => { await apiFetch(`${API_BASE}/alerts`, { method: "DELETE" }); setAlerts([]); }} style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", background: "none", border: "none", cursor: "pointer", fontFamily: "'Space Mono', monospace" }}>Clear</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {alerts.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.2)", fontFamily: "'Space Mono', monospace", fontSize: 12 }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
                  NO THREATS LOGGED
                </div>
              ) : (
                alerts.map(a => <AlertRow key={a.id} alert={a} />)
              )}
            </div>

            {/* Pipeline diagram */}
            <div style={{ borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", padding: 16 }}>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "rgba(255,255,255,0.25)", letterSpacing: "0.12em", marginBottom: 12 }}>PIPELINE</div>
              {[
                { step: "1", label: "Video Frame", color: "#00d4ff", sub: "640×480 JPEG" },
                { step: "2", label: "YOLOv8n", color: "#ffd93d", sub: "Person detection" },
                { step: "3", label: "U-Net", color: "#a855f7", sub: "Pixel segmentation" },
                { step: "4", label: "Annotated Output", color: "#00ff94", sub: "Overlay + alerts" },
              ].map((s, i) => (
                <div key={s.step} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: i < 3 ? 0 : 0 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: s.color + "20", border: `1px solid ${s.color}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontFamily: "'Space Mono', monospace", fontWeight: 700, color: s.color, flexShrink: 0 }}>{s.step}</div>
                    {i < 3 && <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.06)" }} />}
                  </div>
                  <div style={{ paddingTop: 3, paddingBottom: i < 3 ? 0 : 0 }}>
                    <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 700, color: "#fff" }}>{s.label}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Serif Display', serif" }}>{s.sub}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* API reference */}
            <div style={{ borderRadius: 12, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)", padding: 16, fontFamily: "'Space Mono', monospace", fontSize: 11, color: "rgba(255,255,255,0.35)", lineHeight: 2 }}>
              <div style={{ color: "rgba(255,255,255,0.5)", fontWeight: 700, marginBottom: 6 }}>API ENDPOINTS</div>
              <div><span style={{ color: "#00ff94" }}>GET</span>  /health</div>
              <div><span style={{ color: "#ffd93d" }}>POST</span> /analyze</div>
              <div><span style={{ color: "#ffd93d" }}>POST</span> /analyze/upload</div>
              <div><span style={{ color: "#00d4ff" }}>WS</span>   /stream</div>
              <div><span style={{ color: "#00d4ff" }}>GET</span>  /alerts</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
