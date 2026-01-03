import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

const BUILD_ID = "v5.0_" + Date.now();

const API_URL = (() => {
  let url = process.env.REACT_APP_BACKEND_URL || "";
  url = url.trim().replace(/\/$/, "");
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  return url;
})();

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;

// ============================================
// ANIMATED BACKGROUND
// ============================================
const AnimatedBackground = () => (
  <div className="fixed inset-0 -z-10 overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950" />
    <div className="absolute top-0 -left-40 w-[500px] h-[500px] bg-violet-500/15 rounded-full blur-3xl animate-blob" />
    <div className="absolute top-40 -right-40 w-[400px] h-[400px] bg-cyan-500/15 rounded-full blur-3xl animate-blob animation-delay-2000" />
    <div className="absolute -bottom-40 left-1/3 w-[450px] h-[450px] bg-fuchsia-500/15 rounded-full blur-3xl animate-blob animation-delay-4000" />
    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAyKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50" />
  </div>
);

// ============================================
// GLASS CARD COMPONENT
// ============================================
const GlassCard = ({ children, className = "", onClick, hover = true, glow = false }) => (
  <div
    onClick={onClick}
    className={`
      relative bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] rounded-3xl
      ${hover ? 'hover:bg-white/[0.06] hover:border-white/[0.15] cursor-pointer' : ''}
      ${glow ? 'shadow-xl shadow-violet-500/10' : ''}
      transition-all duration-500 ease-out
      ${className}
    `}
  >
    {children}
  </div>
);

// ============================================
// METRIC CARD - For displaying individual metrics
// ============================================
const MetricCard = ({ icon, label, value, description, status, color = "cyan" }) => {
  const statusColors = {
    good: 'from-emerald-500/20 to-green-500/20 border-emerald-500/30',
    warning: 'from-amber-500/20 to-orange-500/20 border-amber-500/30',
    bad: 'from-rose-500/20 to-red-500/20 border-rose-500/30',
    neutral: 'from-slate-500/20 to-gray-500/20 border-slate-500/30'
  };
  
  const textColors = {
    good: 'text-emerald-400',
    warning: 'text-amber-400',
    bad: 'text-rose-400',
    neutral: 'text-slate-400'
  };

  return (
    <div className={`p-4 rounded-2xl bg-gradient-to-br ${statusColors[status]} border transition-all hover:scale-[1.02]`}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        <span className={`text-xl font-bold ${textColors[status]}`}>{value}</span>
      </div>
      <p className="text-white font-medium text-sm">{label}</p>
      <p className="text-slate-400 text-xs mt-1">{description}</p>
    </div>
  );
};

// ============================================
// SCORE RING - Circular progress indicator
// ============================================
const ScoreRing = ({ score, maxScore = 100, label, size = 100 }) => {
  const percentage = (score / maxScore) * 100;
  const radius = (size - 12) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;
  
  const getColor = () => {
    if (percentage >= 70) return { stroke: '#10b981', text: 'text-emerald-400' };
    if (percentage >= 40) return { stroke: '#f59e0b', text: 'text-amber-400' };
    return { stroke: '#ef4444', text: 'text-rose-400' };
  };
  
  const { stroke, text } = getColor();

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
        <circle 
          cx={size/2} cy={size/2} r={radius} fill="none" stroke={stroke} strokeWidth="8"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease-out', filter: `drop-shadow(0 0 8px ${stroke}50)` }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <span className={`text-2xl font-bold ${text}`}>{score}</span>
        <span className="text-xs text-slate-400">{label}</span>
      </div>
    </div>
  );
};

// ============================================
// STREAK FLAME
// ============================================
const StreakFlame = ({ streak }) => {
  const flameSize = Math.min(streak * 3 + 32, 80);
  return (
    <div className="relative flex items-center justify-center">
      <div className="absolute animate-pulse" style={{ fontSize: `${flameSize}px`, filter: 'blur(10px)', opacity: 0.4 }}>🔥</div>
      <div style={{ fontSize: `${flameSize}px` }} className="relative z-10 animate-bounce">🔥</div>
    </div>
  );
};

// ============================================
// BADGE COMPONENT
// ============================================
const Badge = ({ icon, name, description, earned }) => (
  <div className={`p-4 rounded-2xl border transition-all duration-300 ${
    earned ? 'bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-amber-500/30 scale-100' 
           : 'bg-white/5 border-white/10 opacity-40 scale-95'
  }`}>
    <div className={`text-4xl mb-2 ${earned ? '' : 'grayscale'}`}>{icon}</div>
    <p className={`font-semibold text-sm ${earned ? 'text-white' : 'text-slate-400'}`}>{name}</p>
    <p className="text-xs text-slate-500 mt-1">{description}</p>
  </div>
);

// ============================================
// SAFETY DISCLAIMER
// ============================================
const SafetyDisclaimer = ({ onAccept }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
    <GlassCard className="max-w-md w-full p-8" hover={false}>
      <div className="text-center mb-6">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/20 flex items-center justify-center">
          <span className="text-3xl">⚠️</span>
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Responsible Use</h3>
      </div>
      
      <div className="space-y-3 text-sm text-slate-300 mb-6">
        <div className="flex gap-3"><span className="text-emerald-400">✓</span><p>Only upload <strong className="text-white">your own photos</strong></p></div>
        <div className="flex gap-3"><span className="text-emerald-400">✓</span><p>Use <strong className="text-white">appropriate content</strong> only</p></div>
        <div className="flex gap-3"><span className="text-rose-400">✗</span><p>No photos of <strong className="text-white">others without consent</strong></p></div>
        <div className="flex gap-3"><span className="text-cyan-400">ℹ</span><p><strong className="text-white">Face detection required</strong></p></div>
      </div>
      
      <button onClick={onAccept} className="w-full py-3 rounded-xl font-semibold bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-400 hover:to-fuchsia-400 transition-all">
        I Understand
      </button>
    </GlassCard>
  </div>
);

// ============================================
// RESULTS DISPLAY - Comprehensive analysis view
// ============================================
const ResultsDisplay = ({ results, onClose }) => {
  if (!results) return null;

  // Helper to interpret values
  const getEyePouchStatus = (val) => val === 1 ? { text: 'Detected', status: 'warning' } : { text: 'None', status: 'good' };
  
  const getDarkCircleType = (val) => {
    const types = ['None', 'Pigmented', 'Vascular', 'Shadow'];
    return { text: types[val] || 'Unknown', status: val === 0 ? 'good' : 'warning' };
  };
  
  const getSkinType = (val) => {
    const types = ['Oily', 'Dry', 'Neutral', 'Combination'];
    return types[val] || 'Unknown';
  };
  
  const getSkinColor = (val) => {
    const colors = ['Transparent White', 'White', 'Natural', 'Wheat', 'Dark'];
    return colors[val] || 'Unknown';
  };
  
  const getBlackheadSeverity = (val) => {
    const levels = ['None', 'Mild', 'Moderate', 'Severe'];
    const statuses = ['good', 'neutral', 'warning', 'bad'];
    return { text: levels[val] || 'Unknown', status: statuses[val] || 'neutral' };
  };
  
  const getYesNo = (val) => val === 1 ? { text: 'Yes', status: 'warning' } : { text: 'No', status: 'good' };

  const skinAge = results.skin_age?.value || 0;
  const eyePouch = getEyePouchStatus(results.eye_pouch?.value);
  const darkCircle = getDarkCircleType(results.dark_circle?.value);
  const skinType = getSkinType(results.skin_type?.skin_type);
  const skinColor = getSkinColor(results.skin_color?.value);
  const blackhead = getBlackheadSeverity(results.blackhead?.value);
  const foreheadWrinkle = getYesNo(results.forehead_wrinkle?.value);
  const crowsFeet = getYesNo(results.crows_feet?.value);
  const eyeFinelines = getYesNo(results.eye_finelines?.value);
  const glabellaWrinkle = getYesNo(results.glabella_wrinkle?.value);
  const nasolabialFold = getYesNo(results.nasolabial_fold?.value);
  
  // Pores
  const poresForehead = getYesNo(results.pores_forehead?.value);
  const poresLeftCheek = getYesNo(results.pores_left_cheek?.value);
  const poresRightCheek = getYesNo(results.pores_right_cheek?.value);
  const poresJaw = getYesNo(results.pores_jaw?.value);
  
  // Count issues
  const acneCount = results.acne?.rectangle?.length || 0;
  const moleCount = results.mole?.rectangle?.length || 0;
  const spotCount = results.skin_spot?.rectangle?.length || 0;

  // Calculate overall wellness score (simple algorithm)
  let score = 100;
  if (results.eye_pouch?.value === 1) score -= 10;
  if (results.dark_circle?.value > 0) score -= 10;
  if (results.blackhead?.value > 0) score -= results.blackhead.value * 5;
  if (results.forehead_wrinkle?.value === 1) score -= 5;
  if (results.crows_feet?.value === 1) score -= 5;
  if (acneCount > 0) score -= Math.min(acneCount * 2, 15);
  score = Math.max(score, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero Score */}
      <GlassCard className="p-8 text-center" hover={false} glow>
        <h3 className="text-2xl font-bold text-white mb-6">Analysis Complete! ✨</h3>
        <div className="flex justify-center items-center gap-8 mb-6">
          <div className="relative">
            <ScoreRing score={score} label="Wellness" size={120} />
          </div>
          <div className="text-left">
            <p className="text-slate-400 text-sm mb-1">Estimated Skin Age</p>
            <p className="text-5xl font-bold bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
              {skinAge}
            </p>
            <p className="text-slate-500 text-sm">years</p>
          </div>
        </div>
      </GlassCard>

      {/* Eye Area */}
      <GlassCard className="p-6" hover={false}>
        <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span>👁️</span> Eye Area
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard icon="💤" label="Eye Bags" value={eyePouch.text} status={eyePouch.status} description="Puffiness under eyes" />
          <MetricCard icon="🌑" label="Dark Circles" value={darkCircle.text} status={darkCircle.status} description="Under-eye discoloration" />
          <MetricCard icon="🦶" label="Crow's Feet" value={crowsFeet.text} status={crowsFeet.status} description="Corner wrinkles" />
          <MetricCard icon="〰️" label="Eye Fine Lines" value={eyeFinelines.text} status={eyeFinelines.status} description="Under-eye lines" />
        </div>
      </GlassCard>

      {/* Wrinkles & Lines */}
      <GlassCard className="p-6" hover={false}>
        <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span>📏</span> Wrinkles & Lines
        </h4>
        <div className="grid grid-cols-3 gap-3">
          <MetricCard icon="🔝" label="Forehead" value={foreheadWrinkle.text} status={foreheadWrinkle.status} description="Horizontal lines" />
          <MetricCard icon="🔲" label="Glabella" value={glabellaWrinkle.text} status={glabellaWrinkle.status} description="Between eyebrows" />
          <MetricCard icon="😊" label="Smile Lines" value={nasolabialFold.text} status={nasolabialFold.status} description="Nasolabial folds" />
        </div>
      </GlassCard>

      {/* Skin Condition */}
      <GlassCard className="p-6" hover={false}>
        <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span>✨</span> Skin Condition
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard icon="🎨" label="Skin Type" value={skinType} status="neutral" description="Your skin category" />
          <MetricCard icon="🌈" label="Skin Tone" value={skinColor} status="neutral" description="Color classification" />
          <MetricCard icon="⚫" label="Blackheads" value={blackhead.text} status={blackhead.status} description="Clogged pores" />
          <MetricCard icon="🔴" label="Acne" value={acneCount > 0 ? `${acneCount} spots` : 'None'} status={acneCount > 0 ? 'warning' : 'good'} description="Active breakouts" />
        </div>
      </GlassCard>

      {/* Pores */}
      <GlassCard className="p-6" hover={false}>
        <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span>🔍</span> Pore Analysis
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard icon="🔝" label="Forehead" value={poresForehead.text} status={poresForehead.status} description="Enlarged pores" />
          <MetricCard icon="◀️" label="Left Cheek" value={poresLeftCheek.text} status={poresLeftCheek.status} description="Enlarged pores" />
          <MetricCard icon="▶️" label="Right Cheek" value={poresRightCheek.text} status={poresRightCheek.status} description="Enlarged pores" />
          <MetricCard icon="🔽" label="Jaw" value={poresJaw.text} status={poresJaw.status} description="Enlarged pores" />
        </div>
      </GlassCard>

      {/* Additional Info */}
      {(moleCount > 0 || spotCount > 0) && (
        <GlassCard className="p-6" hover={false}>
          <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span>📍</span> Additional Findings
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {moleCount > 0 && <MetricCard icon="⚫" label="Moles" value={`${moleCount} detected`} status="neutral" description="Skin marks" />}
            {spotCount > 0 && <MetricCard icon="🟤" label="Spots" value={`${spotCount} detected`} status="neutral" description="Pigmentation" />}
          </div>
        </GlassCard>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 py-4 rounded-xl font-semibold bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-400 hover:to-fuchsia-400 transition-all">
          Back to Home
        </button>
      </div>
    </div>
  );
};

// ============================================
// MAIN APP
// ============================================
function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('home');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [insights, setInsights] = useState(null);
  const [history, setHistory] = useState([]);
  const [cameraStream, setCameraStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [capturedImageUrl, setCapturedImageUrl] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [notification, setNotification] = useState(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [badges, setBadges] = useState([]);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const faceDetectionRef = useRef(null);

  const showNotification = useCallback((message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  const calculateBadges = useCallback((userData) => {
    setBadges([
      { id: 'first', icon: '📸', name: 'First Scan', description: 'Take your first photo', earned: (userData?.total_photos || 0) >= 1 },
      { id: 'streak3', icon: '🔥', name: '3-Day Streak', description: '3 days in a row', earned: (userData?.longest_streak || 0) >= 3 },
      { id: 'streak7', icon: '⚡', name: 'Week Warrior', description: '7-day streak', earned: (userData?.longest_streak || 0) >= 7 },
      { id: 'streak30', icon: '👑', name: 'Monthly Master', description: '30-day streak', earned: (userData?.longest_streak || 0) >= 30 },
      { id: 'photos10', icon: '🌟', name: 'Dedicated', description: '10 photos taken', earned: (userData?.total_photos || 0) >= 10 },
      { id: 'photos50', icon: '💎', name: 'Committed', description: '50 photos taken', earned: (userData?.total_photos || 0) >= 50 },
    ]);
  }, []);

  useEffect(() => {
    const accepted = localStorage.getItem('disclaimer_accepted');
    if (accepted) setDisclaimerAccepted(true);
    checkAuth();
  }, []);

  useEffect(() => {
    return () => {
      if (cameraStream) cameraStream.getTracks().forEach(track => track.stop());
      if (faceDetectionRef.current) cancelAnimationFrame(faceDetectionRef.current);
    };
  }, [cameraStream]);

  useEffect(() => {
    if (cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current.play().catch(console.error);
        startFaceDetection();
      };
    }
  }, [cameraStream]);

  const startFaceDetection = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const detectFace = () => {
      if (!videoRef.current || !cameraStream) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      if (video.readyState >= 2 && video.videoWidth > 0) {
        canvas.width = 100;
        canvas.height = 100;
        const ctx = canvas.getContext('2d');
        const centerX = video.videoWidth / 2 - 50;
        const centerY = video.videoHeight / 2 - 50;
        ctx.drawImage(video, centerX, centerY, 100, 100, 0, 0, 100, 100);
        
        const imageData = ctx.getImageData(0, 0, 100, 100);
        let skinPixels = 0;
        for (let i = 0; i < imageData.data.length; i += 4) {
          const r = imageData.data[i], g = imageData.data[i + 1], b = imageData.data[i + 2];
          if (r > 60 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 15 && r - b > 15) skinPixels++;
        }
        setFaceDetected(skinPixels / 10000 > 0.15);
      }
      faceDetectionRef.current = requestAnimationFrame(detectFace);
    };
    detectFace();
  }, [cameraStream]);

  const checkAuth = async () => {
    const sessionToken = localStorage.getItem('session_token');
    if (sessionToken) {
      try {
        const response = await fetch(`${API_URL}/api/user/profile`, { headers: { 'session-token': sessionToken } });
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
          calculateBadges(data.user);
        } else {
          localStorage.removeItem('session_token');
        }
      } catch (error) {
        localStorage.removeItem('session_token');
      }
    }
    setLoading(false);
  };

  const handleLogin = () => {
    if (!window.google) { showNotification('Google Sign-In loading...', 'warning'); return; }
    window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleResponse });
    window.google.accounts.id.prompt();
  };

  const handleGoogleResponse = async (response) => {
    try {
      const result = await fetch(`${API_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      });
      if (result.ok) {
        const data = await result.json();
        localStorage.setItem('session_token', data.session_token);
        setUser(data.user);
        calculateBadges(data.user);
        showNotification('Welcome! 👋', 'success');
        if (!disclaimerAccepted) setShowDisclaimer(true);
      } else {
        showNotification('Login failed', 'error');
      }
    } catch (error) {
      showNotification('Login failed', 'error');
    }
  };

  const handleAcceptDisclaimer = () => {
    localStorage.setItem('disclaimer_accepted', 'true');
    setDisclaimerAccepted(true);
    setShowDisclaimer(false);
  };

  const startCamera = async () => {
    if (!disclaimerAccepted) { setShowDisclaimer(true); return; }
    setCameraError(null);
    setFaceDetected(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false 
      });
      setCameraStream(stream);
    } catch (error) {
      setCameraError(error.message);
      showNotification('Camera access failed', 'error');
    }
  };

  const stopCamera = () => {
    if (faceDetectionRef.current) cancelAnimationFrame(faceDetectionRef.current);
    if (cameraStream) { cameraStream.getTracks().forEach(track => track.stop()); setCameraStream(null); }
    if (videoRef.current) videoRef.current.srcObject = null;
    setFaceDetected(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current || !faceDetected) {
      showNotification('Position your face in the frame', 'warning');
      return;
    }
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.readyState < 2) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    
    canvas.toBlob((blob) => {
      if (blob) {
        setCapturedImage(blob);
        setCapturedImageUrl(URL.createObjectURL(blob));
        stopCamera();
      }
    }, 'image/jpeg', 0.95);
  };

  const analyzePhoto = async () => {
    if (!capturedImage) return;
    setUploadLoading(true);
    
    const formData = new FormData();
    formData.append('image', capturedImage, 'face-photo.jpg');
    
    try {
      const response = await fetch(`${API_URL}/api/analyze-face`, {
        method: 'POST',
        headers: { 'session-token': localStorage.getItem('session_token') },
        body: formData
      });
      
      if (response.ok) {
        const data = await response.json();
        setAnalysisResult(data.results);
        setCapturedImage(null);
        if (capturedImageUrl) URL.revokeObjectURL(capturedImageUrl);
        setCapturedImageUrl(null);
        setCurrentView('results');
        setUser(prev => ({ ...prev, total_photos: (prev?.total_photos || 0) + 1 }));
        calculateBadges({ ...user, total_photos: (user?.total_photos || 0) + 1 });
        showNotification('Analysis complete! 🎉', 'success');
      } else {
        const error = await response.json();
        showNotification(error.detail || 'Analysis failed', 'error');
      }
    } catch (error) {
      showNotification('Analysis failed', 'error');
    } finally {
      setUploadLoading(false);
    }
  };

  const fetchInsights = async () => {
    setInsights(null);
    try {
      const response = await fetch(`${API_URL}/api/insights`, { headers: { 'session-token': localStorage.getItem('session_token') } });
      if (response.ok) setInsights(await response.json());
    } catch (error) { console.error(error); }
  };

  const fetchHistory = async () => {
    try {
      const response = await fetch(`${API_URL}/api/analysis/history`, { headers: { 'session-token': localStorage.getItem('session_token') } });
      if (response.ok) { const data = await response.json(); setHistory(data.history || []); }
    } catch (error) { console.error(error); }
  };

  const logout = () => {
    stopCamera();
    localStorage.removeItem('session_token');
    setUser(null);
    setCurrentView('home');
  };

  const navigate = (view) => {
    if (view !== 'camera') stopCamera();
    setCapturedImage(null);
    if (capturedImageUrl) URL.revokeObjectURL(capturedImageUrl);
    setCapturedImageUrl(null);
    setCurrentView(view);
    if (view === 'insights') fetchInsights();
    if (view === 'history') fetchHistory();
  };

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <AnimatedBackground />
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin mx-auto" />
          <p className="mt-6 text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Login
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <AnimatedBackground />
        <div className="max-w-md w-full">
          <div className="text-center mb-10 animate-fade-in">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-500 to-fuchsia-600 mb-6 shadow-2xl shadow-violet-500/30">
              <span className="text-5xl">✨</span>
            </div>
            <h1 className="text-4xl font-bold text-white mb-3">Face Wellness</h1>
            <p className="text-slate-400 text-lg">Track your skin health daily</p>
          </div>

          <GlassCard className="p-6 mb-6" hover={false}>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: '📸', text: 'Daily Selfie' },
                { icon: '🔬', text: '20+ Metrics' },
                { icon: '🔥', text: 'Streaks' },
                { icon: '📧', text: 'Weekly Reports' }
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-sm text-slate-300">{item.text}</span>
                </div>
              ))}
            </div>
          </GlassCard>

          <button onClick={handleLogin} className="w-full py-4 rounded-2xl font-semibold text-white bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 transition-all shadow-xl shadow-violet-500/30 flex items-center justify-center gap-3">
            <svg className="w-6 h-6" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continue with Google
          </button>
          <p className="text-center text-slate-500 text-xs mt-6">🔒 Your data is encrypted & secure</p>
        </div>
      </div>
    );
  }

  // Main App
  return (
    <div className="min-h-screen pb-24">
      <AnimatedBackground />
      
      {showDisclaimer && <SafetyDisclaimer onAccept={handleAcceptDisclaimer} />}
      
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-2xl font-medium animate-slide-in-right backdrop-blur-xl border
          ${notification.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' :
            notification.type === 'error' ? 'bg-rose-500/20 border-rose-500/30 text-rose-300' :
            notification.type === 'warning' ? 'bg-amber-500/20 border-amber-500/30 text-amber-300' :
            'bg-cyan-500/20 border-cyan-500/30 text-cyan-300'}`}>
          {notification.message}
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-slate-950/50 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-lg">
              <span className="text-lg">✨</span>
            </div>
            <span className="text-white font-bold text-xl hidden sm:block">Face Wellness</span>
          </div>
          <div className="flex items-center gap-3">
            <img src={user.picture || ''} alt="" className="w-9 h-9 rounded-full ring-2 ring-violet-500/30" />
            <span className="text-slate-300 font-medium hidden sm:block">{user.name?.split(' ')[0]}</span>
            <button onClick={logout} className="text-slate-400 hover:text-white text-sm ml-2">Logout</button>
          </div>
        </div>
      </header>

      {/* Nav */}
      <nav className="sticky top-[73px] z-30 backdrop-blur-xl bg-slate-950/30 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {[
              { id: 'home', icon: '🏠', label: 'Home' },
              { id: 'camera', icon: '📸', label: 'Scan' },
              { id: 'badges', icon: '🏆', label: 'Badges' },
              { id: 'history', icon: '📊', label: 'History' }
            ].map((item) => (
              <button key={item.id} onClick={() => navigate(item.id)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition-all whitespace-nowrap
                  ${currentView === item.id ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                <span>{item.icon}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        
        {/* HOME */}
        {currentView === 'home' && (
          <div className="space-y-6 animate-fade-in">
            <GlassCard className="p-8 text-center" hover={false} glow>
              <StreakFlame streak={user?.current_streak || 0} />
              <h2 className="text-4xl font-bold text-white mt-4">{user?.current_streak || 0} Day Streak</h2>
              <p className="text-slate-400 mt-2 mb-6">{user?.current_streak > 0 ? "You're on fire! 🔥" : "Start your streak today!"}</p>
              <button onClick={() => navigate('camera')} className="px-8 py-4 rounded-2xl font-semibold bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-400 hover:to-fuchsia-400 transition-all shadow-xl">
                📸 Take Today's Photo
              </button>
            </GlassCard>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <GlassCard className="p-5 text-center">
                <p className="text-3xl font-bold text-cyan-400">{user?.total_photos || 0}</p>
                <p className="text-slate-400 text-sm">Total Scans</p>
              </GlassCard>
              <GlassCard className="p-5 text-center">
                <p className="text-3xl font-bold text-violet-400">{user?.current_streak || 0}</p>
                <p className="text-slate-400 text-sm">Current Streak</p>
              </GlassCard>
              <GlassCard className="p-5 text-center">
                <p className="text-3xl font-bold text-fuchsia-400">{user?.longest_streak || 0}</p>
                <p className="text-slate-400 text-sm">Best Streak</p>
              </GlassCard>
              <GlassCard className="p-5 text-center">
                <p className="text-3xl font-bold text-amber-400">{badges.filter(b => b.earned).length}</p>
                <p className="text-slate-400 text-sm">Badges</p>
              </GlassCard>
            </div>

            <GlassCard className="p-6 border-cyan-500/20" hover={false}>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 flex items-center justify-center text-2xl">📧</div>
                <div className="flex-1">
                  <h4 className="text-white font-semibold">Weekly Reports</h4>
                  <p className="text-slate-400 text-sm">Get comprehensive analysis every Sunday</p>
                </div>
                <span className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 text-xs">Coming Soon</span>
              </div>
            </GlassCard>
          </div>
        )}

        {/* CAMERA */}
        {currentView === 'camera' && (
          <div className="max-w-lg mx-auto animate-fade-in">
            <GlassCard className="p-6" hover={false}>
              <h3 className="text-xl font-bold text-white mb-2 text-center">Daily Wellness Scan</h3>
              <p className="text-slate-400 text-sm text-center mb-6">Natural lighting • Face centered • No filters</p>
              
              {cameraError && <div className="mb-4 p-4 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-sm">{cameraError}</div>}
              
              {!cameraStream && !capturedImage && (
                <div className="text-center py-12">
                  <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center border-2 border-dashed border-white/20">
                    <span className="text-5xl">📸</span>
                  </div>
                  <button onClick={startCamera} className="px-8 py-4 rounded-2xl font-semibold bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-400 hover:to-fuchsia-400 transition-all shadow-xl">
                    Open Camera
                  </button>
                </div>
              )}
              
              {cameraStream && !capturedImage && (
                <div className="space-y-4">
                  <div className="relative rounded-2xl overflow-hidden bg-black aspect-[3/4]">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className={`w-48 h-64 border-2 rounded-full transition-all ${faceDetected ? 'border-emerald-400 shadow-lg shadow-emerald-400/30' : 'border-white/30'}`} />
                    </div>
                    <div className={`absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-sm font-medium ${faceDetected ? 'bg-emerald-500/80 text-white' : 'bg-amber-500/80 text-white'}`}>
                      {faceDetected ? '✓ Face Detected' : '👤 Position face'}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={capturePhoto} disabled={!faceDetected} className={`flex-1 py-4 rounded-xl font-semibold transition-all ${faceDetected ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white' : 'bg-slate-700 text-slate-400 cursor-not-allowed'}`}>
                      {faceDetected ? '📷 Capture' : '⏳ Waiting...'}
                    </button>
                    <button onClick={stopCamera} className="px-6 py-4 rounded-xl font-semibold bg-white/10 text-white hover:bg-white/20">Cancel</button>
                  </div>
                </div>
              )}
              
              {capturedImage && capturedImageUrl && (
                <div className="space-y-4">
                  <div className="relative rounded-2xl overflow-hidden bg-black aspect-[3/4]">
                    <img src={capturedImageUrl} alt="Captured" className="w-full h-full object-cover" />
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-emerald-500/80 text-white text-sm">✓ Ready</div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={analyzePhoto} disabled={uploadLoading} className="flex-1 py-4 rounded-xl font-semibold bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white disabled:opacity-50">
                      {uploadLoading ? <span className="flex items-center justify-center gap-2"><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Analyzing...</span> : '🔬 Analyze Face'}
                    </button>
                    <button onClick={() => { setCapturedImage(null); setCapturedImageUrl(null); startCamera(); }} disabled={uploadLoading} className="px-6 py-4 rounded-xl bg-white/10 text-white disabled:opacity-50">Retake</button>
                  </div>
                </div>
              )}
              
              <canvas ref={canvasRef} className="hidden" />
            </GlassCard>
            <p className="text-center text-slate-500 text-xs mt-4">🔒 Photos processed securely • Results stored for tracking</p>
          </div>
        )}

        {/* RESULTS */}
        {currentView === 'results' && analysisResult && (
          <div className="max-w-3xl mx-auto">
            <ResultsDisplay results={analysisResult} onClose={() => navigate('home')} />
          </div>
        )}

        {/* BADGES */}
        {currentView === 'badges' && (
          <div className="animate-fade-in">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Your Achievements</h2>
              <p className="text-slate-400">{badges.filter(b => b.earned).length} of {badges.length} badges earned</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {badges.map((badge) => <Badge key={badge.id} {...badge} />)}
            </div>
          </div>
        )}

        {/* HISTORY */}
        {currentView === 'history' && (
          <div className="max-w-3xl mx-auto animate-fade-in">
            <GlassCard className="p-6" hover={false}>
              <h3 className="text-2xl font-bold text-white mb-6">Scan History</h3>
              {history.length > 0 ? (
                <div className="space-y-3">
                  {history.map((item, i) => (
                    <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-white font-medium">{new Date(item.timestamp).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                        <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-300">✓ Analyzed</span>
                      </div>
                      {item.results && (
                        <div className="grid grid-cols-4 gap-2 text-sm">
                          <div className="text-center"><p className="text-slate-400">Age</p><p className="text-white font-semibold">{item.results?.skin_age?.value ?? '—'}</p></div>
                          <div className="text-center"><p className="text-slate-400">Eye Bags</p><p className="text-white font-semibold">{item.results?.eye_pouch?.value === 1 ? 'Yes' : 'No'}</p></div>
                          <div className="text-center"><p className="text-slate-400">Dark Circles</p><p className="text-white font-semibold">{item.results?.dark_circle?.value > 0 ? 'Yes' : 'No'}</p></div>
                          <div className="text-center"><p className="text-slate-400">Blackheads</p><p className="text-white font-semibold">{['None', 'Mild', 'Mod', 'Severe'][item.results?.blackhead?.value] || '—'}</p></div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <span className="text-5xl mb-4 block">📊</span>
                  <p className="text-slate-400">No scans yet</p>
                  <button onClick={() => navigate('camera')} className="mt-4 px-6 py-2 rounded-xl bg-violet-500/20 text-violet-300 hover:bg-violet-500/30">Start Scanning</button>
                </div>
              )}
            </GlassCard>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
