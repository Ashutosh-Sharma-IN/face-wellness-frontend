import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const API_URL = process.env.REACT_APP_BACKEND_URL;

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
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    checkAuth();
  }, []);

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
    const redirectUrl = encodeURIComponent(window.location.origin + '/auth-callback');
    window.location.href = `https://auth.emergentagent.com/?redirect=${redirectUrl}`;
  };

  const handleAuthCallback = async () => {
    const hash = window.location.hash;
    const sessionId = hash.split('session_id=')[1];
    
    if (sessionId) {
      try {
        const response = await fetch(`${API_URL}/api/auth/profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId })
        });
        
        if (response.ok) {
          const data = await response.json();
          localStorage.setItem('session_token', data.session_token);
          setUser(data.user);
          setCurrentView('home');
          window.history.replaceState({}, document.title, '/');
        }
      } catch (error) {
        console.error('Auth callback failed:', error);
      }
    }
  };

  useEffect(() => {
    if (window.location.pathname === '/auth-callback' || window.location.hash.includes('session_id=')) {
      handleAuthCallback();
    }
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' },
        audio: false 
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Camera access failed:', error);
      alert('Camera access failed. Please enable camera permissions.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      
      canvas.toBlob(async (blob) => {
        setCapturedImage(blob);
        stopCamera();
      }, 'image/jpeg', 0.8);
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
        
        // Update user stats
        setUser(prev => ({
          ...prev,
          total_photos: prev.total_photos + 1
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
    try {
      const response = await fetch(`${API_URL}/api/insights`, {
        headers: { 'session-token': localStorage.getItem('session_token') }
      });
      if (response.ok) {
        const data = await response.json();
        setInsights(data);
      }
    } catch (error) {
      console.error('Failed to fetch insights:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await fetch(`${API_URL}/api/analysis/history`, {
        headers: { 'session-token': localStorage.getItem('session_token') }
      });
      if (response.ok) {
        const data = await response.json();
        setHistory(data.history);
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  };

  const logout = () => {
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
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Get Started with Google
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-800">Face Wellness</h1>
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

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {['home', 'camera', 'insights', 'history'].map((view) => (
              <button
                key={view}
                onClick={() => {
                  setCurrentView(view);
                  if (view === 'insights') fetchInsights();
                  if (view === 'history') fetchHistory();
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'home' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Total Photos</h3>
              <p className="text-3xl font-bold text-blue-600">{user.total_photos}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Current Streak</h3>
              <p className="text-3xl font-bold text-green-600">{user.current_streak} days</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Longest Streak</h3>
              <p className="text-3xl font-bold text-purple-600">{user.longest_streak} days</p>
            </div>
          </div>
        )}

        {currentView === 'camera' && (
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Take Today's Photo</h3>
              
              {!cameraStream && !capturedImage && (
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
              
              {cameraStream && (
                <div className="text-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full rounded-lg mb-4"
                    style={{ transform: 'scaleX(-1)' }}
                  />
                  <div className="space-x-4">
                    <button
                      onClick={capturePhoto}
                      className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
                    >
                      Capture Photo
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
              
              {capturedImage && (
                <div className="text-center">
                  <div className="bg-gray-100 rounded-lg p-4 mb-4">
                    <p className="text-gray-600 mb-4">Photo captured! Ready to analyze?</p>
                    <div className="space-x-4">
                      <button
                        onClick={analyzePhoto}
                        disabled={uploadLoading}
                        className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        {uploadLoading ? 'Analyzing...' : 'Analyze Photo'}
                      </button>
                      <button
                        onClick={() => setCapturedImage(null)}
                        className="bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-700 transition-colors"
                      >
                        Retake
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
                  
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-800">Personalized Recommendations</h4>
                    {insights.insights.map((insight, index) => (
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
                    ))}
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
              
              {history.length > 0 ? (
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