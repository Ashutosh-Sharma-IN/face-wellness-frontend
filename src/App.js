import React, { useState, useEffect, useRef } from 'react';
import './App.css';

// Build identifier for deployment tracking
const BUILD_ID = "v2.0_" + Date.now();

const API_URL = (() => {
  let url = process.env.REACT_APP_BACKEND_URL || "";
  url = url.trim().replace(/\/$/, "");
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  return url;
})();

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;

// Animated gradient background component
const AnimatedBackground = () => (
  <div className="fixed inset-0 -z-10 overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
    <div className="absolute top-0 -left-40 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-blob" />
    <div className="absolute top-60 -right-40 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-blob animation-delay-2000" />
    <div className="absolute -bottom-40 left-1/2 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl animate-blob animation-delay-4000" />
  </div>
);

// Glassmorphism card component
const GlassCard = ({ children, className = "", onClick, hover = true }) => (
  <div
    onClick={onClick}
    className={`
      bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl
      ${hover ? 'hover:bg-white/10 hover:border-white/20 hover:scale-[1.02] cursor-pointer' : ''}
      transition-all duration-500 ease-out
      ${className}
    `}
  >
    {children}
  </div>
);

// Stat card with animated number
const StatCard = ({ icon, label, value, suffix = "", color = "cyan", delay = 0 }) => (
  <GlassCard className="p-6 group" style={{ animationDelay: `${delay}ms` }}>
    <div className="flex items-center gap-4">
      <div className={`
        w-14 h-14 rounded-2xl flex items-center justify-center text-2xl
        bg-gradient-to-br ${color === 'cyan' ? 'from-cyan-500/20 to-cyan-600/20' : 
        color === 'pink' ? 'from-pink-500/20 to-pink-600/20' : 
        'from-purple-500/20 to-purple-600/20'}
        group-hover:scale-110 transition-transform duration-500
      `}>
        {icon}
      </div>
      <div>
        <p className="text-slate-400 text-sm font-medium tracking-wide uppercase">{label}</p>
        <p className={`text-3xl font-bold bg-gradient-to-r ${
          color === 'cyan' ? 'from-cyan-400 to-cyan-300' :
          color === 'pink' ? 'from-pink-400 to-pink-300' :
          'from-purple-400 to-purple-300'
        } bg-clip-text text-transparent`}>
          {value}{suffix}
        </p>
      </div>
    </div>
  </GlassCard>
);

// Score indicator component
const ScoreIndicator = ({ value, max = 3, label, description }) => {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  const getColor = () => {
    if (percentage <= 33) return { bg: 'from-emerald-500 to-green-400', text: 'text-emerald-400' };
    if (percentage <= 66) return { bg: 'from-amber-500 to-yellow-400', text: 'text-amber-400' };
    return { bg: 'from-rose-500 to-red-400', text: 'text-rose-400' };
  };
  const colors = getColor();
  
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-end">
        <div>
          <p className="text-white font-semibold text-lg">{label}</p>
          <p className="text-slate-400 text-sm">{description}</p>
        </div>
        <span className={`text-2xl font-bold ${colors.text}`}>{value}/{max}</span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div 
          className={`h-full bg-gradient-to-r ${colors.bg} rounded-full transition-all duration-1000 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

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
  const [cameraError, setCameraError] = useState(null);
  const [notification, setNotification] = useState(null);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Show notification
  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  useEffect(() => {
    if (cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current.play().catch(console.error);
      };
    }
  }, [cameraStream]);

  const checkAuth = async () => {
    const sessionToken = localStorage.getItem('session_token');
    if (sessionToken) {
      try {
        const response = await fetch(`${API_URL}/api/user/profile`, {
          headers: { 'session-token': sessionToken }
        });
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        } else {
          localStorage.removeItem('session_token');
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('session_token');
      }
    }
    setLoading(false);
  };

  const handleLogin = () => {
    if (!window.google) {
      showNotification('Google Sign-In is loading...', 'warning');
      return;
    }
    
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleResponse
    });
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
        showNotification('Welcome back! 👋', 'success');
      } else {
        showNotification('Login failed. Please try again.', 'error');
      }
    } catch (error) {
      showNotification('Login failed. Please try again.', 'error');
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false 
      });
      setCameraStream(stream);
    } catch (error) {
      setCameraError(error.message);
      showNotification('Camera access failed', 'error');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video.readyState < 2 || video.videoWidth === 0) {
      showNotification('Camera not ready yet', 'warning');
      return;
    }
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    
    canvas.toBlob((blob) => {
      if (blob) {
        setCapturedImage(blob);
        stopCamera();
        showNotification('Photo captured! ✨', 'success');
      }
    }, 'image/jpeg', 0.9);
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
        setAnalysisResult(data);
        setCapturedImage(null);
        setCurrentView('results');
        setUser(prev => ({ ...prev, total_photos: (prev?.total_photos || 0) + 1 }));
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
      const response = await fetch(`${API_URL}/api/insights`, {
        headers: { 'session-token': localStorage.getItem('session_token') }
      });
      if (response.ok) setInsights(await response.json());
    } catch (error) {
      console.error('Insights error:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await fetch(`${API_URL}/api/analysis/history`, {
        headers: { 'session-token': localStorage.getItem('session_token') }
      });
      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
      }
    } catch (error) {
      console.error('History error:', error);
    }
  };

  const logout = () => {
    stopCamera();
    localStorage.removeItem('session_token');
    setUser(null);
    setCurrentView('home');
    showNotification('See you soon! 👋', 'info');
  };

  const navigate = (view) => {
    if (view !== 'camera') stopCamera();
    setCapturedImage(null);
    setCurrentView(view);
    if (view === 'insights') fetchInsights();
    if (view === 'history') fetchHistory();
  };

  // Loading screen
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <AnimatedBackground />
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto" />
          <p className="mt-6 text-slate-400 font-medium">Loading your wellness data...</p>
        </div>
      </div>
    );
  }

  // Login screen
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <AnimatedBackground />
        
        <div className="max-w-md w-full">
          {/* Logo & Title */}
          <div className="text-center mb-12 animate-fade-in">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-cyan-500 to-purple-600 mb-6 shadow-2xl shadow-cyan-500/25">
              <span className="text-4xl">✨</span>
            </div>
            <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">
              Face Wellness
            </h1>
            <p className="text-slate-400 text-lg">
              Track how your daily habits reflect on your face
            </p>
          </div>

          {/* Features */}
          <GlassCard className="p-8 mb-8 animate-fade-in-up" hover={false}>
            <div className="space-y-4">
              {[
                { icon: '👁️', text: 'Eye puffiness & dark circles' },
                { icon: '🧬', text: 'Skin age analysis' },
                { icon: '📊', text: 'Track trends over time' },
                { icon: '💡', text: 'Personalized insights' }
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4 text-slate-300">
                  <span className="text-2xl">{item.icon}</span>
                  <span className="font-medium">{item.text}</span>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Login Button */}
          <button
            onClick={handleLogin}
            className="w-full py-4 px-6 rounded-2xl font-semibold text-white
              bg-gradient-to-r from-cyan-500 to-purple-600 
              hover:from-cyan-400 hover:to-purple-500
              transform hover:scale-[1.02] active:scale-[0.98]
              transition-all duration-300 ease-out
              shadow-2xl shadow-purple-500/25
              flex items-center justify-center gap-3
              animate-fade-in-up animation-delay-200"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <p className="text-center text-slate-500 text-sm mt-6">
            Your data is encrypted and never shared
          </p>
        </div>
      </div>
    );
  }

  // Main app
  return (
    <div className="min-h-screen pb-24">
      <AnimatedBackground />
      
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-2xl font-medium
          animate-slide-in-right backdrop-blur-xl border
          ${notification.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' :
            notification.type === 'error' ? 'bg-rose-500/20 border-rose-500/30 text-rose-300' :
            notification.type === 'warning' ? 'bg-amber-500/20 border-amber-500/30 text-amber-300' :
            'bg-cyan-500/20 border-cyan-500/30 text-cyan-300'}`}
        >
          {notification.message}
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-slate-950/50 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
              <span className="text-lg">✨</span>
            </div>
            <span className="text-white font-bold text-xl hidden sm:block">Face Wellness</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <img 
                src={user.picture || ''} 
                alt="" 
                className="w-9 h-9 rounded-full ring-2 ring-white/10"
              />
              <span className="text-slate-300 font-medium hidden sm:block">{user.name?.split(' ')[0]}</span>
            </div>
            <button 
              onClick={logout}
              className="text-slate-400 hover:text-white transition-colors text-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="sticky top-[73px] z-30 backdrop-blur-xl bg-slate-950/30 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1">
            {[
              { id: 'home', icon: '🏠', label: 'Home' },
              { id: 'camera', icon: '📸', label: 'Scan' },
              { id: 'insights', icon: '💡', label: 'Insights' },
              { id: 'history', icon: '📊', label: 'History' }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={`
                  flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition-all duration-300
                  ${currentView === item.id 
                    ? 'bg-white/10 text-white' 
                    : 'text-slate-400 hover:text-white hover:bg-white/5'}
                `}
              >
                <span>{item.icon}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        
        {/* HOME VIEW */}
        {currentView === 'home' && (
          <div className="space-y-8 animate-fade-in">
            {/* Welcome */}
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-white mb-2">
                Welcome back, {user.name?.split(' ')[0]} 👋
              </h2>
              <p className="text-slate-400">Here's your wellness overview</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard icon="📸" label="Total Scans" value={user.total_photos || 0} color="cyan" delay={0} />
              <StatCard icon="🔥" label="Current Streak" value={user.current_streak || 0} suffix=" days" color="pink" delay={100} />
              <StatCard icon="🏆" label="Best Streak" value={user.longest_streak || 0} suffix=" days" color="purple" delay={200} />
            </div>

            {/* Quick Action */}
            <GlassCard className="p-8 text-center" onClick={() => navigate('camera')}>
              <div className="text-6xl mb-4">📸</div>
              <h3 className="text-xl font-bold text-white mb-2">Take Today's Scan</h3>
              <p className="text-slate-400 mb-6">Track your daily wellness with a quick selfie</p>
              <button className="px-8 py-3 rounded-xl font-semibold bg-gradient-to-r from-cyan-500 to-purple-600 text-white
                hover:from-cyan-400 hover:to-purple-500 transition-all duration-300">
                Start Scan →
              </button>
            </GlassCard>
          </div>
        )}

        {/* CAMERA VIEW */}
        {currentView === 'camera' && (
          <div className="max-w-lg mx-auto animate-fade-in">
            <GlassCard className="p-6 overflow-hidden" hover={false}>
              <h3 className="text-xl font-bold text-white mb-6 text-center">Daily Wellness Scan</h3>
              
              {cameraError && (
                <div className="mb-4 p-4 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-sm">
                  {cameraError}
                </div>
              )}
              
              {/* Initial State */}
              {!cameraStream && !capturedImage && (
                <div className="text-center py-12">
                  <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-600/20 
                    flex items-center justify-center border-2 border-dashed border-white/20">
                    <span className="text-5xl">📸</span>
                  </div>
                  <p className="text-slate-400 mb-6">Position your face in good lighting</p>
                  <button
                    onClick={startCamera}
                    className="px-8 py-4 rounded-2xl font-semibold bg-gradient-to-r from-cyan-500 to-purple-600 text-white
                      hover:from-cyan-400 hover:to-purple-500 transform hover:scale-105 transition-all duration-300
                      shadow-xl shadow-purple-500/20"
                  >
                    Open Camera
                  </button>
                </div>
              )}
              
              {/* Camera Active */}
              {cameraStream && !capturedImage && (
                <div className="space-y-4">
                  <div className="relative rounded-2xl overflow-hidden bg-black aspect-[3/4]">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                      style={{ transform: 'scaleX(-1)' }}
                    />
                    {/* Face guide overlay */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-48 h-64 border-2 border-cyan-400/50 rounded-full" />
                    </div>
                    {/* Corner guides */}
                    <div className="absolute top-4 left-4 w-8 h-8 border-l-2 border-t-2 border-cyan-400/50 rounded-tl-lg" />
                    <div className="absolute top-4 right-4 w-8 h-8 border-r-2 border-t-2 border-cyan-400/50 rounded-tr-lg" />
                    <div className="absolute bottom-4 left-4 w-8 h-8 border-l-2 border-b-2 border-cyan-400/50 rounded-bl-lg" />
                    <div className="absolute bottom-4 right-4 w-8 h-8 border-r-2 border-b-2 border-cyan-400/50 rounded-br-lg" />
                  </div>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={capturePhoto}
                      className="flex-1 py-4 rounded-xl font-semibold bg-gradient-to-r from-emerald-500 to-green-600 text-white
                        hover:from-emerald-400 hover:to-green-500 transition-all duration-300"
                    >
                      📷 Capture
                    </button>
                    <button
                      onClick={stopCamera}
                      className="px-6 py-4 rounded-xl font-semibold bg-white/10 text-white hover:bg-white/20 transition-all duration-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              
              {/* Photo Preview */}
              {capturedImage && (
                <div className="space-y-4">
                  <div className="rounded-2xl overflow-hidden">
                    <img 
                      src={URL.createObjectURL(capturedImage)} 
                      alt="Captured" 
                      className="w-full"
                    />
                  </div>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={analyzePhoto}
                      disabled={uploadLoading}
                      className="flex-1 py-4 rounded-xl font-semibold bg-gradient-to-r from-cyan-500 to-purple-600 text-white
                        hover:from-cyan-400 hover:to-purple-500 transition-all duration-300 disabled:opacity-50"
                    >
                      {uploadLoading ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Analyzing...
                        </span>
                      ) : '🔍 Analyze Face'}
                    </button>
                    <button
                      onClick={() => { setCapturedImage(null); startCamera(); }}
                      disabled={uploadLoading}
                      className="px-6 py-4 rounded-xl font-semibold bg-white/10 text-white hover:bg-white/20 transition-all duration-300 disabled:opacity-50"
                    >
                      Retake
                    </button>
                  </div>
                </div>
              )}
              
              <canvas ref={canvasRef} className="hidden" />
            </GlassCard>
          </div>
        )}

        {/* RESULTS VIEW */}
        {currentView === 'results' && analysisResult && (
          <div className="max-w-2xl mx-auto animate-fade-in">
            <GlassCard className="p-8" hover={false}>
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-green-600/20 mb-4">
                  <span className="text-3xl">✅</span>
                </div>
                <h3 className="text-2xl font-bold text-white">Analysis Complete</h3>
                <p className="text-slate-400 mt-1">Here's what we found</p>
              </div>
              
              <div className="space-y-6">
                <ScoreIndicator 
                  value={analysisResult.results?.eye_pouch?.value || 0} 
                  max={1} 
                  label="Eye Puffiness" 
                  description="Presence of eye bags"
                />
                <ScoreIndicator 
                  value={analysisResult.results?.dark_circle?.value || 0} 
                  max={3} 
                  label="Dark Circles" 
                  description="Under-eye discoloration"
                />
                <ScoreIndicator 
                  value={analysisResult.results?.forehead_wrinkle?.value || 0} 
                  max={1} 
                  label="Forehead Wrinkles" 
                  description="Visible forehead lines"
                />
                
                {/* Skin Age */}
                <div className="p-6 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-purple-600/10 border border-white/10">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-white font-semibold text-lg">Estimated Skin Age</p>
                      <p className="text-slate-400 text-sm">Based on skin analysis</p>
                    </div>
                    <span className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                      {analysisResult.results?.skin_age?.value || '—'}
                    </span>
                  </div>
                </div>
              </div>
              
              <button
                onClick={() => navigate('home')}
                className="w-full mt-8 py-4 rounded-xl font-semibold bg-white/10 text-white hover:bg-white/20 transition-all duration-300"
              >
                Back to Home
              </button>
            </GlassCard>
          </div>
        )}

        {/* INSIGHTS VIEW */}
        {currentView === 'insights' && (
          <div className="max-w-2xl mx-auto animate-fade-in">
            <GlassCard className="p-8" hover={false}>
              <h3 className="text-2xl font-bold text-white mb-6">Your Insights</h3>
              
              {!insights ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto" />
                  <p className="mt-4 text-slate-400">Generating insights...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {insights.averages && (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-center">
                        <p className="text-cyan-400 text-2xl font-bold">{insights.averages.eye_pouch}</p>
                        <p className="text-slate-400 text-xs mt-1">Avg Eye Puffiness</p>
                      </div>
                      <div className="p-4 rounded-xl bg-pink-500/10 border border-pink-500/20 text-center">
                        <p className="text-pink-400 text-2xl font-bold">{insights.averages.dark_circle}</p>
                        <p className="text-slate-400 text-xs mt-1">Avg Dark Circles</p>
                      </div>
                      <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-center">
                        <p className="text-purple-400 text-2xl font-bold">{insights.averages.skin_age}</p>
                        <p className="text-slate-400 text-xs mt-1">Avg Skin Age</p>
                      </div>
                    </div>
                  )}
                  
                  {insights.insights?.map((insight, i) => (
                    <div 
                      key={i} 
                      className={`p-4 rounded-xl border ${
                        insight.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20' :
                        insight.type === 'warning' ? 'bg-amber-500/10 border-amber-500/20' :
                        'bg-cyan-500/10 border-cyan-500/20'
                      }`}
                    >
                      <p className={`${
                        insight.type === 'success' ? 'text-emerald-300' :
                        insight.type === 'warning' ? 'text-amber-300' :
                        'text-cyan-300'
                      }`}>
                        {insight.type === 'success' ? '✅ ' : insight.type === 'warning' ? '⚠️ ' : '💡 '}
                        {insight.message}
                      </p>
                    </div>
                  ))}
                  
                  {(!insights.insights || insights.insights.length === 0) && (
                    <p className="text-slate-400 text-center py-8">
                      Take more scans to generate personalized insights!
                    </p>
                  )}
                </div>
              )}
            </GlassCard>
          </div>
        )}

        {/* HISTORY VIEW */}
        {currentView === 'history' && (
          <div className="max-w-3xl mx-auto animate-fade-in">
            <GlassCard className="p-8" hover={false}>
              <h3 className="text-2xl font-bold text-white mb-6">Scan History</h3>
              
              {history.length > 0 ? (
                <div className="space-y-3">
                  {history.map((item, i) => (
                    <div 
                      key={i} 
                      className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-300"
                    >
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-white font-medium">
                          {new Date(item.timestamp).toLocaleDateString('en-US', { 
                            weekday: 'short', month: 'short', day: 'numeric' 
                          })}
                        </span>
                        <span className="text-slate-400 text-sm">
                          {new Date(item.timestamp).toLocaleTimeString('en-US', { 
                            hour: '2-digit', minute: '2-digit' 
                          })}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-sm">
                        <div className="text-center">
                          <p className="text-slate-400">Eyes</p>
                          <p className="text-white font-semibold">{item.results?.eye_pouch?.value || 0}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-slate-400">Dark</p>
                          <p className="text-white font-semibold">{item.results?.dark_circle?.value || 0}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-slate-400">Age</p>
                          <p className="text-white font-semibold">{item.results?.skin_age?.value || '—'}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-slate-400">Wrinkle</p>
                          <p className="text-white font-semibold">{item.results?.forehead_wrinkle?.value || 0}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <span className="text-5xl mb-4 block">📊</span>
                  <p className="text-slate-400">No history yet. Take your first scan!</p>
                  <button
                    onClick={() => navigate('camera')}
                    className="mt-4 px-6 py-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all"
                  >
                    Start Scanning
                  </button>
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
