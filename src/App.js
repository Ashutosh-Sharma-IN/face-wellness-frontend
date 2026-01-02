import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

// Debug logging helper
const DEBUG = true;
const log = (...args) => {
  if (DEBUG) {
    console.log(`[${new Date().toISOString().split('T')[1].slice(0, 8)}]`, ...args);
  }
};

// FIX: Ensure API_URL has proper protocol
const API_URL = (() => {
  let url = process.env.REACT_APP_BACKEND_URL || "";
  url = url.trim().replace(/\/$/, "");
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  log('🌐 API_URL configured as:', url);
  return url;
})();

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
log('🔑 Google Client ID:', GOOGLE_CLIENT_ID ? `${GOOGLE_CLIENT_ID.slice(0, 20)}...` : 'NOT SET');

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
  const [debugInfo, setDebugInfo] = useState({});
  const [showDebug, setShowDebug] = useState(true);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Update debug info
  const updateDebug = useCallback((key, value) => {
    setDebugInfo(prev => ({ ...prev, [key]: value, lastUpdate: new Date().toISOString() }));
  }, []);

  useEffect(() => {
    log('🚀 App mounted');
    updateDebug('appMounted', true);
    updateDebug('apiUrl', API_URL);
    updateDebug('googleClientId', GOOGLE_CLIENT_ID ? 'SET' : 'NOT SET');
    updateDebug('googleLibLoaded', !!window.google);
    checkAuth();
  }, [updateDebug]);

  // Check Google library loaded
  useEffect(() => {
    const checkGoogle = setInterval(() => {
      if (window.google) {
        log('✅ Google library loaded');
        updateDebug('googleLibLoaded', true);
        clearInterval(checkGoogle);
      }
    }, 500);
    
    setTimeout(() => clearInterval(checkGoogle), 10000);
    return () => clearInterval(checkGoogle);
  }, [updateDebug]);

  // Cleanup camera stream
  useEffect(() => {
    return () => {
      if (cameraStream) {
        log('🧹 Cleaning up camera stream');
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  // CRITICAL: Handle video element and stream connection
  useEffect(() => {
    log('🎥 Video/Stream effect triggered', {
      hasStream: !!cameraStream,
      hasVideoRef: !!videoRef.current,
      videoRefId: videoRef.current?.id
    });
    
    updateDebug('hasStream', !!cameraStream);
    updateDebug('hasVideoRef', !!videoRef.current);

    if (cameraStream && videoRef.current) {
      log('🎥 Attempting to connect stream to video element');
      
      const video = videoRef.current;
      
      // Clear any existing srcObject first
      video.srcObject = null;
      
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        try {
          video.srcObject = cameraStream;
          log('✅ Stream assigned to video.srcObject');
          updateDebug('srcObjectAssigned', true);
          
          video.onloadedmetadata = () => {
            log('✅ Video metadata loaded', {
              videoWidth: video.videoWidth,
              videoHeight: video.videoHeight,
              readyState: video.readyState
            });
            updateDebug('videoWidth', video.videoWidth);
            updateDebug('videoHeight', video.videoHeight);
            updateDebug('readyState', video.readyState);
            
            video.play()
              .then(() => {
                log('✅ Video playing successfully');
                updateDebug('videoPlaying', true);
              })
              .catch(err => {
                log('❌ Video play failed:', err.message);
                updateDebug('playError', err.message);
                // Try muted
                video.muted = true;
                video.play()
                  .then(() => {
                    log('✅ Video playing (muted)');
                    updateDebug('videoPlaying', 'muted');
                  })
                  .catch(e => {
                    log('❌ Muted play also failed:', e.message);
                    updateDebug('playError', `muted also failed: ${e.message}`);
                  });
              });
          };
          
          video.onerror = (e) => {
            log('❌ Video element error:', e);
            updateDebug('videoError', e.message || 'unknown error');
          };
          
        } catch (err) {
          log('❌ Error assigning srcObject:', err);
          updateDebug('srcObjectError', err.message);
        }
      }, 100);
    }
  }, [cameraStream, currentView, updateDebug]);

  const checkAuth = async () => {
    log('🔐 Checking auth...');
    const sessionToken = localStorage.getItem('session_token');
    updateDebug('hasSessionToken', !!sessionToken);
    
    if (sessionToken) {
      try {
        log('🔐 Verifying session token with backend...');
        const response = await fetch(`${API_URL}/api/user/profile`, {
          headers: { 'session-token': sessionToken }
        });
        log('🔐 Profile response status:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          log('✅ User authenticated:', data.user?.email);
          setUser(data.user);
          updateDebug('userEmail', data.user?.email);
        } else {
          log('❌ Session invalid, removing token');
          localStorage.removeItem('session_token');
        }
      } catch (error) {
        log('❌ Auth check failed:', error.message);
        updateDebug('authError', error.message);
        localStorage.removeItem('session_token');
      }
    }
    setLoading(false);
  };

  const handleLogin = () => {
    log('🔐 handleLogin called');
    updateDebug('loginAttempted', new Date().toISOString());
    
    if (!window.google) {
      log('❌ Google library not loaded');
      updateDebug('loginError', 'Google library not loaded');
      alert('Google Sign-In is still loading. Please wait a moment and try again.');
      return;
    }
    
    try {
      log('🔐 Initializing Google Sign-In...');
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      
      log('🔐 Prompting for Google Sign-In...');
      window.google.accounts.id.prompt((notification) => {
        log('🔐 Prompt notification:', notification);
        updateDebug('promptNotification', JSON.stringify(notification));
        
        if (notification.isNotDisplayed()) {
          log('❌ Prompt not displayed:', notification.getNotDisplayedReason());
          updateDebug('promptNotDisplayed', notification.getNotDisplayedReason());
          
          // Fallback: try renderButton approach
          log('🔐 Trying fallback button render...');
          const buttonDiv = document.getElementById('google-signin-fallback');
          if (buttonDiv) {
            window.google.accounts.id.renderButton(buttonDiv, {
              theme: 'outline',
              size: 'large',
              width: '100%'
            });
            updateDebug('fallbackButtonRendered', true);
          }
        }
        
        if (notification.isSkippedMoment()) {
          log('⚠️ Prompt skipped:', notification.getSkippedReason());
          updateDebug('promptSkipped', notification.getSkippedReason());
        }
      });
    } catch (error) {
      log('❌ Google Sign-In error:', error);
      updateDebug('googleSignInError', error.message);
      alert(`Sign-in error: ${error.message}`);
    }
  };

  const handleGoogleResponse = async (response) => {
    log('🔐 Google response received');
    updateDebug('googleResponseReceived', true);
    
    try {
      log('🔐 Sending credential to backend...');
      const result = await fetch(`${API_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      });
      
      log('🔐 Backend response status:', result.status);
      
      if (result.ok) {
        const data = await result.json();
        log('✅ Login successful:', data.user?.email);
        localStorage.setItem('session_token', data.session_token);
        setUser(data.user);
        setCurrentView('home');
        updateDebug('loginSuccess', true);
      } else {
        const error = await result.json();
        log('❌ Login failed:', error);
        updateDebug('loginFailed', JSON.stringify(error));
        alert('Login failed. Please try again.');
      }
    } catch (error) {
      log('❌ Login error:', error.message);
      updateDebug('loginError', error.message);
      alert('Login failed. Please try again.');
    }
  };

  const startCamera = async () => {
    log('📸 startCamera called');
    setCameraError(null);
    updateDebug('cameraStartAttempt', new Date().toISOString());
    
    try {
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not available. Make sure you are using HTTPS.');
      }
      
      log('📸 Requesting camera access...');
      updateDebug('requestingCamera', true);
      
      const constraints = { 
        video: { 
          facingMode: 'user',
          width: { ideal: 640 },  // Lower resolution for testing
          height: { ideal: 480 }
        },
        audio: false 
      };
      
      log('📸 Constraints:', JSON.stringify(constraints));
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      log('📸 ✅ Camera access granted!');
      log('📸 Stream active:', stream.active);
      log('📸 Video tracks:', stream.getVideoTracks().length);
      
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        log('📸 Track settings:', JSON.stringify(videoTrack.getSettings()));
        updateDebug('trackSettings', JSON.stringify(videoTrack.getSettings()));
      }
      
      updateDebug('streamActive', stream.active);
      updateDebug('videoTracks', stream.getVideoTracks().length);
      
      setCameraStream(stream);
      
    } catch (error) {
      log('❌ Camera error:', error.name, error.message);
      updateDebug('cameraError', `${error.name}: ${error.message}`);
      
      let errorMessage = 'Camera access failed.';
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Camera permission denied. Please allow camera access in your browser settings and reload the page.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No camera found on this device.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Camera is being used by another application.';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = 'Camera does not support the requested resolution.';
      } else if (error.name === 'SecurityError') {
        errorMessage = 'Camera access blocked. Make sure you are using HTTPS.';
      } else {
        errorMessage = `Camera error: ${error.message}`;
      }
      
      setCameraError(errorMessage);
    }
  };

  const stopCamera = () => {
    log('📸 stopCamera called');
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => {
        log('📸 Stopping track:', track.kind, track.label);
        track.stop();
      });
      setCameraStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraError(null);
    updateDebug('cameraStopped', true);
  };

  const capturePhoto = () => {
    log('📷 capturePhoto called');
    
    if (!videoRef.current) {
      log('❌ No video ref');
      alert('Video element not ready');
      return;
    }
    
    if (!canvasRef.current) {
      log('❌ No canvas ref');
      alert('Canvas element not ready');
      return;
    }
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    log('📷 Video state:', {
      readyState: video.readyState,
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      paused: video.paused,
      ended: video.ended
    });
    
    if (video.readyState < 2) {
      alert('Video not ready yet. Please wait for the camera to fully load.');
      return;
    }
    
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      alert('Video dimensions are zero. Camera may not be properly connected.');
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
        log('📷 ✅ Photo captured, size:', blob.size);
        setCapturedImage(blob);
        stopCamera();
        updateDebug('photoCaptured', blob.size);
      } else {
        log('❌ Failed to create blob');
        alert('Failed to capture photo');
      }
    }, 'image/jpeg', 0.9);
  };

  const analyzePhoto = async () => {
    if (!capturedImage) return;
    
    log('🔍 Starting analysis...');
    setUploadLoading(true);
    
    const formData = new FormData();
    formData.append('image', capturedImage, 'face-photo.jpg');
    
    try {
      const response = await fetch(`${API_URL}/api/analyze-face`, {
        method: 'POST',
        headers: { 'session-token': localStorage.getItem('session_token') },
        body: formData
      });
      
      log('🔍 Analysis response:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        log('✅ Analysis complete');
        setAnalysisResult(data);
        setCapturedImage(null);
        setCurrentView('results');
        setUser(prev => ({ ...prev, total_photos: (prev?.total_photos || 0) + 1 }));
      } else {
        const error = await response.json();
        log('❌ Analysis failed:', error);
        alert(error.detail || 'Analysis failed');
      }
    } catch (error) {
      log('❌ Analysis error:', error.message);
      alert('Analysis failed. Please try again.');
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
      if (response.ok) {
        const data = await response.json();
        setInsights(data);
      } else {
        setInsights({ message: 'Failed to load insights', insights: [] });
      }
    } catch (error) {
      setInsights({ message: 'Failed to load insights', insights: [] });
    }
  };

  const fetchHistory = async () => {
    setHistory([]);
    try {
      const response = await fetch(`${API_URL}/api/analysis/history`, {
        headers: { 'session-token': localStorage.getItem('session_token') }
      });
      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  };

  const logout = () => {
    stopCamera();
    localStorage.removeItem('session_token');
    setUser(null);
    setCurrentView('home');
    setAnalysisResult(null);
    setInsights(null);
    setHistory([]);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  };

  const getScoreColor = (value) => {
    if (value <= 1) return 'text-green-600';
    if (value <= 2) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreDescription = (value, type) => {
    if (type === 'eye_pouch' || type === 'dark_circle') {
      if (value <= 1) return 'Excellent';
      if (value <= 2) return 'Good';
      return 'Needs attention';
    }
    return 'Normal';
  };

  // Debug Panel Component
  const DebugPanel = () => (
    <div className="fixed bottom-0 left-0 right-0 bg-black bg-opacity-90 text-green-400 text-xs font-mono p-2 max-h-48 overflow-auto z-50">
      <div className="flex justify-between items-center mb-2">
        <span className="font-bold">🔧 Debug Panel</span>
        <button onClick={() => setShowDebug(false)} className="text-red-400 hover:text-red-300">
          [Hide]
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {Object.entries(debugInfo).map(([key, value]) => (
          <div key={key} className="truncate">
            <span className="text-gray-400">{key}:</span>{' '}
            <span className={typeof value === 'boolean' ? (value ? 'text-green-400' : 'text-red-400') : ''}>
              {typeof value === 'boolean' ? (value ? '✓' : '✗') : String(value).slice(0, 30)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
        {showDebug && <DebugPanel />}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-800 mb-2">Face Wellness Tracker</h1>
              <p className="text-gray-600">Track how your daily habits reflect on your face</p>
            </div>
            
            <div className="space-y-6">
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-semibold text-blue-800 mb-2">✨ What we analyze:</h3>
                <ul className="text-sm text-blue-700 space-y-1 text-left">
                  <li>• Eye puffiness & dark circles</li>
                  <li>• Skin age & wrinkles</li>
                  <li>• Fatigue indicators</li>
                  <li>• Daily habit correlations</li>
                </ul>
              </div>
              
              <button
                onClick={handleLogin}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>Sign in with Google</span>
              </button>
              
              {/* Fallback Google Sign-In button container */}
              <div id="google-signin-fallback" className="mt-4"></div>
              
              {/* Manual note about incognito */}
              <p className="text-xs text-gray-500 mt-4">
                ⚠️ Having trouble in Incognito? Google Sign-In requires third-party cookies.
                Try in a normal browser window.
              </p>
            </div>
          </div>
        </div>
        {showDebug && <DebugPanel />}
        {!showDebug && (
          <button 
            onClick={() => setShowDebug(true)}
            className="fixed bottom-4 right-4 bg-gray-800 text-white px-3 py-1 rounded text-xs"
          >
            Show Debug
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-800">Face Wellness Tracker</h1>
            <div className="flex items-center space-x-4">
              <img src={user.picture || ''} alt="" className="w-8 h-8 rounded-full"/>
              <span className="text-sm font-medium text-gray-700">{user.name}</span>
              <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700">Logout</button>
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {['home', 'camera', 'insights', 'history'].map((view) => (
              <button
                key={view}
                onClick={() => {
                  if (view !== 'camera') stopCamera();
                  setCurrentView(view);
                  if (view === 'insights') fetchInsights();
                  else if (view === 'history') fetchHistory();
                }}
                className={`py-4 px-2 border-b-2 font-medium text-sm capitalize ${
                  currentView === view
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {view}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-56">
        {currentView === 'home' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Total Photos</h3>
              <p className="text-3xl font-bold text-blue-600">{user.total_photos || 0}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Current Streak</h3>
              <p className="text-3xl font-bold text-green-600">{user.current_streak || 0} days</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Longest Streak</h3>
              <p className="text-3xl font-bold text-purple-600">{user.longest_streak || 0} days</p>
            </div>
          </div>
        )}

        {currentView === 'camera' && (
          <div className="max-w-lg mx-auto">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Take Today's Photo</h3>
              
              {cameraError && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  <strong>Error:</strong> {cameraError}
                </div>
              )}
              
              {/* State 1: No camera, no captured image - show start button */}
              {!cameraStream && !capturedImage && (
                <div className="text-center">
                  <div className="bg-gray-100 rounded-lg p-8 mb-4">
                    <div className="text-6xl mb-4">📸</div>
                    <p className="text-gray-600 mb-4">Ready to capture your daily wellness photo?</p>
                    <button
                      onClick={startCamera}
                      className="bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-lg"
                    >
                      🎥 Start Camera
                    </button>
                  </div>
                </div>
              )}
              
              {/* State 2: Camera stream active - show video */}
              {cameraStream && !capturedImage && (
                <div className="text-center">
                  <div className="relative bg-black rounded-lg overflow-hidden mb-4" style={{ minHeight: '360px' }}>
                    <video
                      ref={videoRef}
                      id="camera-video"
                      autoPlay
                      playsInline
                      muted
                      style={{ 
                        width: '100%', 
                        height: '100%',
                        objectFit: 'cover',
                        transform: 'scaleX(-1)'
                      }}
                    />
                    {/* Face guide overlay */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-48 h-64 border-2 border-white border-opacity-50 rounded-full"></div>
                    </div>
                  </div>
                  
                  <div className="flex justify-center space-x-4">
                    <button
                      onClick={capturePhoto}
                      className="bg-green-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
                    >
                      📷 Capture
                    </button>
                    <button
                      onClick={stopCamera}
                      className="bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              
              {/* State 3: Photo captured - show preview */}
              {capturedImage && (
                <div className="text-center">
                  <div className="mb-4">
                    <img 
                      src={URL.createObjectURL(capturedImage)} 
                      alt="Captured" 
                      className="w-full rounded-lg"
                    />
                  </div>
                  <p className="text-gray-600 mb-4">📸 Photo captured! Ready to analyze?</p>
                  <div className="flex justify-center space-x-4">
                    <button
                      onClick={analyzePhoto}
                      disabled={uploadLoading}
                      className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
                    >
                      {uploadLoading ? '⏳ Analyzing...' : '🔍 Analyze'}
                    </button>
                    <button
                      onClick={() => { setCapturedImage(null); startCamera(); }}
                      disabled={uploadLoading}
                      className="bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-700 disabled:opacity-50"
                    >
                      🔄 Retake
                    </button>
                  </div>
                </div>
              )}
              
              <canvas ref={canvasRef} style={{ display: 'none' }} />
            </div>
          </div>
        )}

        {currentView === 'results' && analysisResult && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-6">Analysis Results</h3>
              <div className="grid grid-cols-2 gap-4">
                {['eye_pouch', 'dark_circle', 'skin_age', 'forehead_wrinkle'].map(key => {
                  const result = analysisResult.results[key];
                  const labels = {
                    eye_pouch: 'Eye Puffiness',
                    dark_circle: 'Dark Circles', 
                    skin_age: 'Skin Age',
                    forehead_wrinkle: 'Wrinkles'
                  };
                  return (
                    <div key={key} className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-800 mb-2">{labels[key]}</h4>
                      <p className={`text-2xl font-bold ${key === 'skin_age' ? 'text-green-600' : getScoreColor(result.value)}`}>
                        {key === 'skin_age' ? `${result.value} years` : `${result.value}/3`}
                      </p>
                      {result.confidence && (
                        <p className="text-xs text-gray-500">
                          Confidence: {Math.round(result.confidence * 100)}%
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 text-center">
                <button
                  onClick={() => setCurrentView('home')}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700"
                >
                  Back to Home
                </button>
              </div>
            </div>
          </div>
        )}

        {currentView === 'insights' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-6">Your Insights</h3>
              {insights ? (
                <div className="space-y-4">
                  {insights.averages && (
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="bg-blue-50 rounded-lg p-4 text-center">
                        <p className="text-sm text-blue-800">Avg Eye Puffiness</p>
                        <p className="text-2xl font-bold text-blue-600">{insights.averages.eye_pouch}</p>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-4 text-center">
                        <p className="text-sm text-purple-800">Avg Dark Circles</p>
                        <p className="text-2xl font-bold text-purple-600">{insights.averages.dark_circle}</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-4 text-center">
                        <p className="text-sm text-green-800">Avg Skin Age</p>
                        <p className="text-2xl font-bold text-green-600">{insights.averages.skin_age}</p>
                      </div>
                    </div>
                  )}
                  {insights.insights?.map((insight, i) => (
                    <div key={i} className={`p-4 rounded-lg border ${
                      insight.type === 'success' ? 'bg-green-50 border-green-200' :
                      insight.type === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                      'bg-blue-50 border-blue-200'
                    }`}>
                      {insight.message}
                    </div>
                  ))}
                  {(!insights.insights || insights.insights.length === 0) && (
                    <p className="text-gray-600 text-center">{insights.message || 'Take more photos to generate insights!'}</p>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600">Loading insights...</p>
                </div>
              )}
            </div>
          </div>
        )}

        {currentView === 'history' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-6">Analysis History</h3>
              {history.length > 0 ? (
                <div className="space-y-4">
                  {history.map((analysis, i) => (
                    <div key={i} className="border rounded-lg p-4">
                      <h4 className="font-medium text-gray-800 mb-2">{formatDate(analysis.timestamp)}</h4>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Eye Puffiness</p>
                          <p className={`font-semibold ${getScoreColor(analysis.results.eye_pouch.value)}`}>
                            {analysis.results.eye_pouch.value}/3
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600">Dark Circles</p>
                          <p className={`font-semibold ${getScoreColor(analysis.results.dark_circle.value)}`}>
                            {analysis.results.dark_circle.value}/3
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600">Skin Age</p>
                          <p className="font-semibold text-green-600">{analysis.results.skin_age.value} yrs</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Wrinkles</p>
                          <p className={`font-semibold ${getScoreColor(analysis.results.forehead_wrinkle.value)}`}>
                            {analysis.results.forehead_wrinkle.value}/3
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600 text-center py-8">No history yet. Take your first photo!</p>
              )}
            </div>
          </div>
        )}
      </main>
      
      {showDebug && <DebugPanel />}
      {!showDebug && (
        <button 
          onClick={() => setShowDebug(true)}
          className="fixed bottom-4 right-4 bg-gray-800 text-white px-3 py-1 rounded text-xs z-40"
        >
          🔧 Debug
        </button>
      )}
    </div>
  );
}

export default App;
