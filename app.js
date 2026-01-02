import React, { useState, useEffect, useRef } from 'react';
import './App.css';

// DEPLOYMENT TEST - If you see "BUILD ID: xxx" on screen, deployment works
const BUILD_ID = "BUILD_" + Date.now();
console.log("🚀 APP LOADED - BUILD ID:", BUILD_ID);

const API_URL = (() => {
  let url = process.env.REACT_APP_BACKEND_URL || "";
  url = url.trim().replace(/\/$/, "");
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  console.log('🌐 API_URL:', url);
  return url;
})();

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;

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
  const [debugLog, setDebugLog] = useState(["App initialized: " + BUILD_ID]);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Simple debug logger that shows on screen
  const addLog = (msg) => {
    console.log("📝", msg);
    setDebugLog(prev => [...prev.slice(-10), `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  useEffect(() => {
    addLog("useEffect running - checking auth");
    checkAuth();
  }, []);

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  // Connect stream to video when both are ready
  useEffect(() => {
    if (cameraStream && videoRef.current) {
      addLog("Connecting stream to video element");
      videoRef.current.srcObject = cameraStream;
      videoRef.current.onloadedmetadata = () => {
        addLog("Video metadata loaded, playing...");
        videoRef.current.play()
          .then(() => addLog("✅ Video playing!"))
          .catch(e => addLog("❌ Play failed: " + e.message));
      };
    }
  }, [cameraStream]);

  const checkAuth = async () => {
    const sessionToken = localStorage.getItem('session_token');
    if (sessionToken) {
      try {
        addLog("Checking session token...");
        const response = await fetch(`${API_URL}/api/user/profile`, {
          headers: { 'session-token': sessionToken }
        });
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
          addLog("✅ Logged in as: " + data.user?.email);
        } else {
          localStorage.removeItem('session_token');
          addLog("Session invalid, removed");
        }
      } catch (error) {
        addLog("❌ Auth error: " + error.message);
        localStorage.removeItem('session_token');
      }
    } else {
      addLog("No session token found");
    }
    setLoading(false);
  };

  const handleLogin = () => {
    addLog("Login button clicked");
    if (!window.google) {
      addLog("❌ Google library not loaded");
      alert('Google Sign-In is loading, please wait...');
      return;
    }
    
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleResponse
    });
    window.google.accounts.id.prompt((notification) => {
      addLog("Google prompt: " + JSON.stringify(notification));
    });
  };

  const handleGoogleResponse = async (response) => {
    addLog("Google response received");
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
        addLog("✅ Login successful");
      } else {
        addLog("❌ Login failed: " + result.status);
        alert('Login failed');
      }
    } catch (error) {
      addLog("❌ Login error: " + error.message);
      alert('Login failed');
    }
  };

  const startCamera = async () => {
    addLog("📸 START CAMERA CLICKED!");
    setCameraError(null);
    
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera API not available");
      }
      
      addLog("Requesting camera permission...");
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false 
      });
      
      addLog("✅ Camera access granted! Tracks: " + stream.getVideoTracks().length);
      setCameraStream(stream);
      
    } catch (error) {
      addLog("❌ Camera error: " + error.name + " - " + error.message);
      setCameraError(error.message);
    }
  };

  const stopCamera = () => {
    addLog("Stopping camera");
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const capturePhoto = () => {
    addLog("📷 Capture clicked");
    if (!videoRef.current || !canvasRef.current) {
      addLog("❌ Video or canvas not ready");
      return;
    }
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    addLog(`Video state: ${video.readyState}, ${video.videoWidth}x${video.videoHeight}`);
    
    if (video.readyState < 2 || video.videoWidth === 0) {
      alert("Video not ready yet");
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
        addLog("✅ Photo captured: " + blob.size + " bytes");
        setCapturedImage(blob);
        stopCamera();
      }
    }, 'image/jpeg', 0.9);
  };

  const analyzePhoto = async () => {
    if (!capturedImage) return;
    addLog("Starting analysis...");
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
        addLog("✅ Analysis complete");
        setAnalysisResult(data);
        setCapturedImage(null);
        setCurrentView('results');
        setUser(prev => ({ ...prev, total_photos: (prev?.total_photos || 0) + 1 }));
      } else {
        const error = await response.json();
        addLog("❌ Analysis failed: " + error.detail);
        alert(error.detail || 'Analysis failed');
      }
    } catch (error) {
      addLog("❌ Analysis error: " + error.message);
      alert('Analysis failed');
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
  };

  const getScoreColor = (value) => {
    if (value <= 1) return 'text-green-600';
    if (value <= 2) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Debug Panel - Always visible
  const DebugPanel = () => (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: '#1a1a2e',
      color: '#0f0',
      padding: '10px',
      fontFamily: 'monospace',
      fontSize: '11px',
      maxHeight: '150px',
      overflowY: 'auto',
      zIndex: 9999,
      borderTop: '2px solid #0f0'
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
        🔧 DEBUG PANEL | Build: {BUILD_ID}
      </div>
      {debugLog.map((log, i) => (
        <div key={i} style={{ opacity: 0.9 }}>{log}</div>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4">Loading...</p>
        </div>
        <DebugPanel />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center pb-40">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Face Wellness Tracker</h1>
            <p className="text-gray-600 mb-6">Track how your daily habits reflect on your face</p>
            
            <button
              onClick={handleLogin}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700"
            >
              Sign in with Google
            </button>
            
            <p className="text-xs text-gray-400 mt-4">Build: {BUILD_ID}</p>
          </div>
        </div>
        <DebugPanel />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 pb-40">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-800">Face Wellness</h1>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">{user.name}</span>
            <button onClick={logout} className="text-sm text-red-500">Logout</button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 flex space-x-6">
          {['home', 'camera', 'insights', 'history'].map((view) => (
            <button
              key={view}
              onClick={() => {
                addLog("Nav: " + view);
                if (view !== 'camera') stopCamera();
                setCurrentView(view);
                if (view === 'insights') fetchInsights();
                if (view === 'history') fetchHistory();
              }}
              className={`py-3 px-2 border-b-2 font-medium text-sm capitalize ${
                currentView === view
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500'
              }`}
            >
              {view}
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        
        {/* HOME */}
        {currentView === 'home' && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <p className="text-gray-600 text-sm">Total Photos</p>
              <p className="text-3xl font-bold text-blue-600">{user.total_photos || 0}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <p className="text-gray-600 text-sm">Current Streak</p>
              <p className="text-3xl font-bold text-green-600">{user.current_streak || 0}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <p className="text-gray-600 text-sm">Longest Streak</p>
              <p className="text-3xl font-bold text-purple-600">{user.longest_streak || 0}</p>
            </div>
          </div>
        )}

        {/* CAMERA */}
        {currentView === 'camera' && (
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Take Today's Photo</h3>
              
              {cameraError && (
                <div className="mb-4 p-3 bg-red-100 text-red-700 rounded text-sm">
                  {cameraError}
                </div>
              )}
              
              {/* No camera, no image */}
              {!cameraStream && !capturedImage && (
                <div className="text-center py-8">
                  <div className="text-6xl mb-4">📸</div>
                  <button
                    onClick={startCamera}
                    className="bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-blue-700"
                  >
                    Start Camera
                  </button>
                </div>
              )}
              
              {/* Camera active */}
              {cameraStream && !capturedImage && (
                <div className="text-center">
                  <div className="bg-black rounded-lg overflow-hidden mb-4" style={{ minHeight: '300px' }}>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{ width: '100%', transform: 'scaleX(-1)' }}
                    />
                  </div>
                  <div className="space-x-4">
                    <button
                      onClick={capturePhoto}
                      className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold"
                    >
                      📷 Capture
                    </button>
                    <button
                      onClick={stopCamera}
                      className="bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              
              {/* Photo captured */}
              {capturedImage && (
                <div className="text-center">
                  <img 
                    src={URL.createObjectURL(capturedImage)} 
                    alt="Captured" 
                    className="w-full rounded-lg mb-4"
                  />
                  <div className="space-x-4">
                    <button
                      onClick={analyzePhoto}
                      disabled={uploadLoading}
                      className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50"
                    >
                      {uploadLoading ? 'Analyzing...' : '🔍 Analyze'}
                    </button>
                    <button
                      onClick={() => { setCapturedImage(null); startCamera(); }}
                      className="bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold"
                    >
                      Retake
                    </button>
                  </div>
                </div>
              )}
              
              <canvas ref={canvasRef} style={{ display: 'none' }} />
            </div>
          </div>
        )}

        {/* RESULTS */}
        {currentView === 'results' && analysisResult && (
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Analysis Results</h3>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(analysisResult.results).map(([key, val]) => (
                  <div key={key} className="bg-gray-50 rounded p-4">
                    <p className="text-sm text-gray-600 capitalize">{key.replace('_', ' ')}</p>
                    <p className={`text-2xl font-bold ${getScoreColor(val.value)}`}>
                      {key === 'skin_age' ? `${val.value} yrs` : `${val.value}/3`}
                    </p>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setCurrentView('home')}
                className="mt-6 w-full bg-blue-600 text-white py-3 rounded-lg font-semibold"
              >
                Back to Home
              </button>
            </div>
          </div>
        )}

        {/* INSIGHTS */}
        {currentView === 'insights' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Your Insights</h3>
            {insights ? (
              <div>
                {insights.averages && (
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="bg-blue-50 rounded p-4 text-center">
                      <p className="text-xs text-blue-800">Avg Eye Puffiness</p>
                      <p className="text-xl font-bold text-blue-600">{insights.averages.eye_pouch}</p>
                    </div>
                    <div className="bg-purple-50 rounded p-4 text-center">
                      <p className="text-xs text-purple-800">Avg Dark Circles</p>
                      <p className="text-xl font-bold text-purple-600">{insights.averages.dark_circle}</p>
                    </div>
                    <div className="bg-green-50 rounded p-4 text-center">
                      <p className="text-xs text-green-800">Avg Skin Age</p>
                      <p className="text-xl font-bold text-green-600">{insights.averages.skin_age}</p>
                    </div>
                  </div>
                )}
                {insights.insights?.map((ins, i) => (
                  <div key={i} className={`p-3 rounded mb-2 ${
                    ins.type === 'success' ? 'bg-green-50' : 
                    ins.type === 'warning' ? 'bg-yellow-50' : 'bg-blue-50'
                  }`}>
                    {ins.message}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">Loading...</p>
            )}
          </div>
        )}

        {/* HISTORY */}
        {currentView === 'history' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">History</h3>
            {history.length > 0 ? (
              <div className="space-y-3">
                {history.map((h, i) => (
                  <div key={i} className="border rounded p-3">
                    <p className="font-medium">{new Date(h.timestamp).toLocaleDateString()}</p>
                    <div className="grid grid-cols-4 gap-2 mt-2 text-sm">
                      <div>Eye: {h.results.eye_pouch.value}/3</div>
                      <div>Dark: {h.results.dark_circle.value}/3</div>
                      <div>Age: {h.results.skin_age.value}</div>
                      <div>Wrinkle: {h.results.forehead_wrinkle.value}/3</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No history yet</p>
            )}
          </div>
        )}
      </main>

      <DebugPanel />
    </div>
  );
}

export default App;
