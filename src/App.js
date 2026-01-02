import React, { useState, useEffect, useRef } from 'react';
import './App.css';

// FIX: Ensure API_URL has proper protocol
const API_URL = (() => {
  let url = process.env.REACT_APP_BACKEND_URL || "";
  url = url.replace(/\/$/, ""); // Remove trailing slash
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url; // Add https if missing
  }
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
  const [showCamera, setShowCamera] = useState(false); // NEW: Controls camera visibility
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    checkAuth();
  }, []);

  // FIX: Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  // FIX: Handle stream assignment AFTER video element is in DOM
  useEffect(() => {
    if (cameraStream && videoRef.current) {
      console.log('🎥 Assigning stream to video element');
      videoRef.current.srcObject = cameraStream;
      
      videoRef.current.onloadedmetadata = () => {
        console.log('🎥 Video metadata loaded, attempting to play');
        videoRef.current.play().catch(err => {
          console.error('Video play failed:', err);
          videoRef.current.muted = true;
          videoRef.current.play().catch(e => console.error('Muted play also failed:', e));
        });
      };
    }
  }, [cameraStream, showCamera]); // Runs when stream OR showCamera changes

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
    if (window.google) {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleResponse
      });
      
      window.google.accounts.id.prompt();
    } else {
      console.error('Google Sign-In not loaded');
      alert('Google Sign-In is loading, please try again in a moment.');
    }
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
        setCurrentView('home');
      } else {
        const error = await result.json();
        console.error('Login failed:', error);
        alert('Login failed. Please try again.');
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('Login failed. Please try again.');
    }
  };

  // FIX: Completely rewritten camera start function
  const startCamera = async () => {
    console.log('📸 startCamera called');
    setCameraError(null);
    
    try {
      // First, show the camera container (video element)
      setShowCamera(true);
      
      console.log('📸 Requesting camera access...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false 
      });
      
      console.log('📸 Camera access granted, stream:', stream);
      console.log('📸 Stream tracks:', stream.getTracks());
      
      // Store the stream - useEffect will handle assigning to video
      setCameraStream(stream);
      
    } catch (error) {
      console.error('❌ Camera access failed:', error);
      setShowCamera(false);
      
      if (error.name === 'NotAllowedError') {
        setCameraError('Camera permission denied. Please allow camera access in your browser settings.');
      } else if (error.name === 'NotFoundError') {
        setCameraError('No camera found. Please connect a camera and try again.');
      } else if (error.name === 'NotReadableError') {
        setCameraError('Camera is in use by another application. Please close other apps using the camera.');
      } else {
        setCameraError(`Camera access failed: ${error.message}`);
      }
    }
  };

  const stopCamera = () => {
    console.log('📸 Stopping camera');
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => {
        console.log('📸 Stopping track:', track.kind);
        track.stop();
      });
      setCameraStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setShowCamera(false);
    setCameraError(null);
  };

  const capturePhoto = () => {
    console.log('📷 Capturing photo...');
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      console.log('📷 Video readyState:', video.readyState);
      console.log('📷 Video dimensions:', video.videoWidth, 'x', video.videoHeight);
      
      if (video.readyState >= video.HAVE_CURRENT_DATA && video.videoWidth > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        // Mirror the image to match the preview
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0);
        
        canvas.toBlob(async (blob) => {
          if (blob) {
            console.log('📷 Photo captured, blob size:', blob.size);
            setCapturedImage(blob);
            stopCamera();
          } else {
            alert('Failed to capture photo. Please try again.');
          }
        }, 'image/jpeg', 0.9);
      } else {
        alert('Video not ready yet. Please wait a moment and try again.');
      }
    } else {
      console.error('📷 Video or canvas ref not available');
    }
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
        
        setUser(prev => ({
          ...prev,
          total_photos: (prev?.total_photos || 0) + 1
        }));
      } else {
        const error = await response.json();
        alert(error.detail || 'Analysis failed');
      }
    } catch (error) {
      console.error('Analysis failed:', error);
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
        console.error('Failed to fetch insights');
        setInsights({ message: 'Failed to load insights', insights: [] });
      }
    } catch (error) {
      console.error('Failed to fetch insights:', error);
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
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getScoreColor = (value, max = 3) => {
    const percentage = (value / max) * 100;
    if (percentage <= 30) return 'text-green-600';
    if (percentage <= 60) return 'text-yellow-600';
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
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
                <ul className="text-sm text-blue-700 space-y-1">
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
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-800">Face Wellness Tracker</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <img 
                  src={user.picture || '/api/placeholder/32/32'} 
                  alt={user.name} 
                  className="w-8 h-8 rounded-full"
                />
                <span className="text-sm font-medium text-gray-700">{user.name}</span>
              </div>
              <button
                onClick={logout}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Logout
              </button>
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
                  if (view !== 'camera') {
                    stopCamera();
                  }
                  
                  setCurrentView(view);
                  
                  if (view === 'insights') {
                    fetchInsights();
                  } else if (view === 'history') {
                    fetchHistory();
                  }
                }}
                className={`py-4 px-2 border-b-2 font-medium text-sm capitalize ${
                  currentView === view
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {view}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Take Today's Photo</h3>
              
              {/* Error display */}
              {cameraError && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {cameraError}
                  <button 
                    onClick={() => setCameraError(null)}
                    className="ml-2 underline"
                  >
                    Dismiss
                  </button>
                </div>
              )}
              
              {/* Initial state - no camera, no captured image */}
              {!showCamera && !capturedImage && (
                <div className="text-center">
                  <div className="bg-gray-100 rounded-lg p-8 mb-4">
                    <div className="text-6xl mb-4">📸</div>
                    <p className="text-gray-600 mb-4">Ready to capture your daily wellness photo?</p>
                    <button
                      onClick={startCamera}
                      className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                    >
                      Start Camera
                    </button>
                  </div>
                </div>
              )}
              
              {/* Camera view - FIX: Video element always exists when showCamera is true */}
              {showCamera && !capturedImage && (
                <div className="text-center">
                  <div className="relative inline-block">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full max-w-sm rounded-lg mb-4 bg-black"
                      style={{ transform: 'scaleX(-1)', minHeight: '300px' }}
                    />
                    {/* Loading overlay while stream is connecting */}
                    {!cameraStream && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 rounded-lg">
                        <div className="text-white text-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                          <p>Connecting to camera...</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-x-4">
                    <button
                      onClick={capturePhoto}
                      disabled={!cameraStream}
                      className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      📷 Capture Photo
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
              
              {/* Captured image preview */}
              {capturedImage && (
                <div className="text-center">
                  <div className="bg-gray-100 rounded-lg p-4 mb-4">
                    <img 
                      src={URL.createObjectURL(capturedImage)} 
                      alt="Captured" 
                      className="w-full max-w-sm mx-auto rounded-lg mb-4"
                    />
                    <p className="text-gray-600 mb-4">📸 Photo captured! Ready to analyze?</p>
                    <div className="space-x-4">
                      <button
                        onClick={analyzePhoto}
                        disabled={uploadLoading}
                        className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        {uploadLoading ? '⏳ Analyzing...' : '🔍 Analyze Photo'}
                      </button>
                      <button
                        onClick={() => {
                          setCapturedImage(null);
                          startCamera();
                        }}
                        className="bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-700 transition-colors"
                      >
                        🔄 Retake
                      </button>
                    </div>
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
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-800 mb-2">Eye Puffiness</h4>
                  <p className={`text-2xl font-bold ${getScoreColor(analysisResult.results.eye_pouch.value)}`}>
                    {analysisResult.results.eye_pouch.value}/3
                  </p>
                  <p className="text-sm text-gray-600">
                    {getScoreDescription(analysisResult.results.eye_pouch.value, 'eye_pouch')}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Confidence: {Math.round(analysisResult.results.eye_pouch.confidence * 100)}%
                  </p>
                </div>
                
                <div className="bg-purple-50 rounded-lg p-4">
                  <h4 className="font-semibold text-purple-800 mb-2">Dark Circles</h4>
                  <p className={`text-2xl font-bold ${getScoreColor(analysisResult.results.dark_circle.value)}`}>
                    {analysisResult.results.dark_circle.value}/3
                  </p>
                  <p className="text-sm text-gray-600">
                    {getScoreDescription(analysisResult.results.dark_circle.value, 'dark_circle')}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Confidence: {Math.round(analysisResult.results.dark_circle.confidence * 100)}%
                  </p>
                </div>
                
                <div className="bg-green-50 rounded-lg p-4">
                  <h4 className="font-semibold text-green-800 mb-2">Skin Age</h4>
                  <p className="text-2xl font-bold text-green-600">
                    {analysisResult.results.skin_age.value} years
                  </p>
                  <p className="text-sm text-gray-600">Estimated skin age</p>
                </div>
                
                <div className="bg-yellow-50 rounded-lg p-4">
                  <h4 className="font-semibold text-yellow-800 mb-2">Wrinkles</h4>
                  <p className={`text-2xl font-bold ${getScoreColor(analysisResult.results.forehead_wrinkle.value)}`}>
                    {analysisResult.results.forehead_wrinkle.value}/3
                  </p>
                  <p className="text-sm text-gray-600">Forehead wrinkles</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Confidence: {Math.round(analysisResult.results.forehead_wrinkle.confidence * 100)}%
                  </p>
                </div>
              </div>
              
              <div className="mt-6 text-center">
                <button
                  onClick={() => setCurrentView('home')}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
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
                <div className="space-y-6">
                  {insights.averages && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-blue-50 rounded-lg p-4 text-center">
                        <p className="text-sm text-blue-800 font-medium">Avg Eye Puffiness</p>
                        <p className="text-2xl font-bold text-blue-600">{insights.averages.eye_pouch}</p>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-4 text-center">
                        <p className="text-sm text-purple-800 font-medium">Avg Dark Circles</p>
                        <p className="text-2xl font-bold text-purple-600">{insights.averages.dark_circle}</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-4 text-center">
                        <p className="text-sm text-green-800 font-medium">Avg Skin Age</p>
                        <p className="text-2xl font-bold text-green-600">{insights.averages.skin_age}</p>
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-800">Personalized Recommendations</h4>
                    {insights.insights && insights.insights.length > 0 ? (
                      insights.insights.map((insight, index) => (
                        <div
                          key={index}
                          className={`p-4 rounded-lg ${
                            insight.type === 'success' ? 'bg-green-50 border-green-200' :
                            insight.type === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                            'bg-blue-50 border-blue-200'
                          } border`}
                        >
                          <p className="text-sm">{insight.message}</p>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4 text-gray-600">
                        {insights.message || 'No insights available yet. Take more photos to generate insights!'}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600">Generating insights...</p>
                </div>
              )}
            </div>
          </div>
        )}

        {currentView === 'history' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-6">Analysis History</h3>
              
              {history && history.length > 0 ? (
                <div className="space-y-4">
                  {history.map((analysis, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-medium text-gray-800">{formatDate(analysis.timestamp)}</h4>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
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
                          <p className="font-semibold text-green-600">{analysis.results.skin_age.value} years</p>
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
                <div className="text-center py-8">
                  <p className="text-gray-600">No analysis history yet. Take your first photo!</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
