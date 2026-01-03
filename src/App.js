import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

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
  </div>
);

// ============================================
// GLASS CARD
// ============================================
const GlassCard = ({ children, className = "", onClick, hover = true, glow = false }) => (
  <div onClick={onClick} className={`relative bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] rounded-3xl
    ${hover ? 'hover:bg-white/[0.06] hover:border-white/[0.15] cursor-pointer' : ''}
    ${glow ? 'shadow-xl shadow-violet-500/10' : ''} transition-all duration-500 ${className}`}>
    {children}
  </div>
);

// ============================================
// METRIC CARD
// ============================================
const MetricCard = ({ icon, label, value, description, status }) => {
  const statusColors = {
    good: 'from-emerald-500/20 to-green-500/20 border-emerald-500/30',
    warning: 'from-amber-500/20 to-orange-500/20 border-amber-500/30',
    bad: 'from-rose-500/20 to-red-500/20 border-rose-500/30',
    neutral: 'from-slate-500/20 to-gray-500/20 border-slate-500/30'
  };
  const textColors = { good: 'text-emerald-400', warning: 'text-amber-400', bad: 'text-rose-400', neutral: 'text-slate-400' };

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
// STREAK FLAME
// ============================================
const StreakFlame = ({ streak }) => {
  const size = Math.min(streak * 3 + 32, 80);
  return (
    <div className="relative flex items-center justify-center">
      <div className="absolute animate-pulse" style={{ fontSize: `${size}px`, filter: 'blur(10px)', opacity: 0.4 }}>🔥</div>
      <div style={{ fontSize: `${size}px` }} className="relative z-10 animate-bounce">🔥</div>
    </div>
  );
};

// ============================================
// FULL RESULTS DISPLAY - Reusable for both new and historical
// ============================================
const FullResultsDisplay = ({ results, date, habits, onClose, isHistorical = false }) => {
  if (!results) return null;

  const getEyePouchStatus = (val) => val === 1 ? { text: 'Detected', status: 'warning' } : { text: 'None', status: 'good' };
  const getEyePouchSeverity = (val) => {
    const levels = ['Mild', 'Moderate', 'Severe'];
    return levels[val] || 'Unknown';
  };
  const getDarkCircleType = (val) => {
    const types = ['None', 'Pigmented', 'Vascular', 'Shadow'];
    return { text: types[val] || 'Unknown', status: val === 0 ? 'good' : 'warning' };
  };
  const getSkinType = (val) => ['Oily', 'Dry', 'Neutral', 'Combination'][val] || 'Unknown';
  const getSkinColor = (val) => ['Very Light', 'Light', 'Natural', 'Tan', 'Dark'][val] || 'Unknown';
  const getBlackheadSeverity = (val) => {
    const levels = ['None', 'Mild', 'Moderate', 'Severe'];
    const statuses = ['good', 'neutral', 'warning', 'bad'];
    return { text: levels[val] || 'Unknown', status: statuses[val] || 'neutral' };
  };
  const getYesNo = (val) => val === 1 ? { text: 'Yes', status: 'warning' } : { text: 'No', status: 'good' };

  const skinAge = results.skin_age?.value || 0;
  const eyePouch = getEyePouchStatus(results.eye_pouch?.value);
  const eyePouchSeverity = results.eye_pouch_severity?.value;
  const darkCircle = getDarkCircleType(results.dark_circle?.value);
  const skinType = getSkinType(results.skin_type?.skin_type);
  const skinColor = getSkinColor(results.skin_color?.value);
  const blackhead = getBlackheadSeverity(results.blackhead?.value);
  const foreheadWrinkle = getYesNo(results.forehead_wrinkle?.value);
  const crowsFeet = getYesNo(results.crows_feet?.value);
  const eyeFinelines = getYesNo(results.eye_finelines?.value);
  const glabellaWrinkle = getYesNo(results.glabella_wrinkle?.value);
  const nasolabialFold = getYesNo(results.nasolabial_fold?.value);
  const poresForehead = getYesNo(results.pores_forehead?.value);
  const poresLeftCheek = getYesNo(results.pores_left_cheek?.value);
  const poresRightCheek = getYesNo(results.pores_right_cheek?.value);
  const poresJaw = getYesNo(results.pores_jaw?.value);
  const acneCount = results.acne?.rectangle?.length || 0;
  const moleCount = results.mole?.rectangle?.length || 0;
  const spotCount = results.skin_spot?.rectangle?.length || 0;

  // Calculate wellness score
  let score = 100;
  if (results.eye_pouch?.value === 1) score -= 10;
  if (results.dark_circle?.value > 0) score -= 10;
  if (results.blackhead?.value > 0) score -= results.blackhead.value * 5;
  if (results.forehead_wrinkle?.value === 1) score -= 5;
  if (results.crows_feet?.value === 1) score -= 5;
  if (acneCount > 0) score -= Math.min(acneCount * 2, 15);
  score = Math.max(score, 0);

  const formattedDate = date ? new Date(date).toLocaleDateString('en-US', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  }) : 'Today';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <GlassCard className="p-6" hover={false} glow>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-2xl font-bold text-white">
              {isHistorical ? '📋 Scan Report' : '✨ Analysis Complete!'}
            </h3>
            <p className="text-slate-400 mt-1">{formattedDate}</p>
          </div>
          {isHistorical && (
            <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">&times;</button>
          )}
        </div>
        
        <div className="flex flex-wrap justify-center items-center gap-8">
          {/* Wellness Score */}
          <div className="text-center">
            <div className="relative w-24 h-24 mx-auto">
              <svg className="w-24 h-24 transform -rotate-90">
                <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
                <circle cx="48" cy="48" r="40" fill="none" 
                  stroke={score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${score * 2.51} 251`}
                  style={{ filter: `drop-shadow(0 0 8px ${score >= 70 ? '#10b98150' : score >= 40 ? '#f59e0b50' : '#ef444450'})` }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-2xl font-bold ${score >= 70 ? 'text-emerald-400' : score >= 40 ? 'text-amber-400' : 'text-rose-400'}`}>
                  {score}
                </span>
                <span className="text-xs text-slate-400">Score</span>
              </div>
            </div>
          </div>
          
          {/* Skin Age */}
          <div className="text-center">
            <p className="text-slate-400 text-sm mb-1">Skin Age</p>
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
          <span>👁️</span> Eye Area Analysis
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard icon="💤" label="Eye Bags" 
            value={eyePouch.text + (eyePouchSeverity !== undefined && results.eye_pouch?.value === 1 ? ` (${getEyePouchSeverity(eyePouchSeverity)})` : '')} 
            status={eyePouch.status} description="Puffiness under eyes" />
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

      {/* Pores Analysis */}
      <GlassCard className="p-6" hover={false}>
        <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span>🔍</span> Pore Analysis
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard icon="🔝" label="Forehead" value={poresForehead.text} status={poresForehead.status} description="Enlarged pores" />
          <MetricCard icon="◀️" label="Left Cheek" value={poresLeftCheek.text} status={poresLeftCheek.status} description="Enlarged pores" />
          <MetricCard icon="▶️" label="Right Cheek" value={poresRightCheek.text} status={poresRightCheek.status} description="Enlarged pores" />
          <MetricCard icon="🔽" label="Jaw Area" value={poresJaw.text} status={poresJaw.status} description="Enlarged pores" />
        </div>
      </GlassCard>

      {/* Additional Findings */}
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

      {/* Habits on that day (if available) */}
      {habits && (
        <GlassCard className="p-6" hover={false}>
          <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span>📝</span> Logged Habits That Day
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-white/5 text-center">
              <p className="text-2xl">😴</p>
              <p className="text-white font-bold">{habits.sleep_hours || '—'}h</p>
              <p className="text-slate-400 text-xs">Sleep</p>
            </div>
            <div className="p-3 rounded-xl bg-white/5 text-center">
              <p className="text-2xl">💧</p>
              <p className="text-white font-bold">{habits.water_glasses || '—'}</p>
              <p className="text-slate-400 text-xs">Water (glasses)</p>
            </div>
            <div className="p-3 rounded-xl bg-white/5 text-center">
              <p className="text-2xl">💪</p>
              <p className="text-white font-bold">{habits.exercise_minutes || '—'}m</p>
              <p className="text-slate-400 text-xs">Exercise</p>
            </div>
            <div className="p-3 rounded-xl bg-white/5 text-center">
              <p className="text-2xl">😰</p>
              <p className="text-white font-bold">{habits.stress_level || '—'}/10</p>
              <p className="text-slate-400 text-xs">Stress</p>
            </div>
          </div>
          {habits.notes && (
            <div className="mt-4 p-3 rounded-xl bg-white/5">
              <p className="text-slate-400 text-xs mb-1">Notes:</p>
              <p className="text-white text-sm">{habits.notes}</p>
            </div>
          )}
        </GlassCard>
      )}

      {/* Action Button */}
      <button onClick={onClose} className="w-full py-4 rounded-xl font-semibold bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-400 hover:to-fuchsia-400 transition-all">
        {isHistorical ? '← Back to History' : 'Back to Home'}
      </button>
    </div>
  );
};

// ============================================
// HABIT TRACKING MODAL
// ============================================
const HabitTrackingModal = ({ onSave, onClose, existingData }) => {
  const [habits, setHabits] = useState(existingData || {
    sleep_hours: 7, water_glasses: 4, exercise_minutes: 0, meals_homecooked: 2,
    screen_time_hours: 4, outdoor_time_minutes: 30, caffeine_cups: 2, alcohol_drinks: 0,
    stress_level: 5, mood: 'neutral', productivity: 5, notes: ''
  });

  const moods = [
    { value: 'great', emoji: '😄', label: 'Great' },
    { value: 'good', emoji: '🙂', label: 'Good' },
    { value: 'neutral', emoji: '😐', label: 'Okay' },
    { value: 'tired', emoji: '😴', label: 'Tired' },
    { value: 'stressed', emoji: '😰', label: 'Stressed' },
    { value: 'sad', emoji: '😢', label: 'Sad' }
  ];

  const SliderInput = ({ label, icon, value, onChange, min, max, unit, goodRange }) => {
    const isGood = goodRange ? value >= goodRange[0] && value <= goodRange[1] : true;
    return (
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-slate-300 text-sm flex items-center gap-2"><span>{icon}</span> {label}</span>
          <span className={`font-bold ${isGood ? 'text-emerald-400' : 'text-amber-400'}`}>{value} {unit}</span>
        </div>
        <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(parseInt(e.target.value))}
          className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-500 [&::-webkit-slider-thumb]:cursor-pointer" />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <GlassCard className="max-w-lg w-full p-6 my-8" hover={false}>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white">📝 Daily Check-in</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">&times;</button>
        </div>

        <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
          <div className="space-y-4">
            <h4 className="text-violet-400 font-semibold text-sm uppercase tracking-wide">💤 Sleep & Rest</h4>
            <SliderInput label="Hours of Sleep" icon="🛏️" value={habits.sleep_hours} 
              onChange={(v) => setHabits({...habits, sleep_hours: v})} min={0} max={12} unit="hrs" goodRange={[7, 9]} />
          </div>

          <div className="space-y-4">
            <h4 className="text-cyan-400 font-semibold text-sm uppercase tracking-wide">🍽️ Nutrition</h4>
            <SliderInput label="Water Intake" icon="💧" value={habits.water_glasses} 
              onChange={(v) => setHabits({...habits, water_glasses: v})} min={0} max={15} unit="glasses" goodRange={[8, 15]} />
            <SliderInput label="Home-cooked Meals" icon="🍳" value={habits.meals_homecooked} 
              onChange={(v) => setHabits({...habits, meals_homecooked: v})} min={0} max={5} unit="meals" goodRange={[2, 5]} />
            <SliderInput label="Caffeine" icon="☕" value={habits.caffeine_cups} 
              onChange={(v) => setHabits({...habits, caffeine_cups: v})} min={0} max={10} unit="cups" goodRange={[0, 3]} />
            <SliderInput label="Alcohol" icon="🍷" value={habits.alcohol_drinks} 
              onChange={(v) => setHabits({...habits, alcohol_drinks: v})} min={0} max={10} unit="drinks" goodRange={[0, 1]} />
          </div>

          <div className="space-y-4">
            <h4 className="text-emerald-400 font-semibold text-sm uppercase tracking-wide">🏃 Activity</h4>
            <SliderInput label="Exercise" icon="💪" value={habits.exercise_minutes} 
              onChange={(v) => setHabits({...habits, exercise_minutes: v})} min={0} max={180} unit="min" goodRange={[30, 180]} />
            <SliderInput label="Outdoor Time" icon="🌳" value={habits.outdoor_time_minutes} 
              onChange={(v) => setHabits({...habits, outdoor_time_minutes: v})} min={0} max={240} unit="min" goodRange={[30, 240]} />
            <SliderInput label="Screen Time" icon="📱" value={habits.screen_time_hours} 
              onChange={(v) => setHabits({...habits, screen_time_hours: v})} min={0} max={16} unit="hrs" goodRange={[0, 4]} />
          </div>

          <div className="space-y-4">
            <h4 className="text-pink-400 font-semibold text-sm uppercase tracking-wide">🧠 Mood & Wellness</h4>
            <div>
              <p className="text-slate-300 text-sm mb-3">How are you feeling today?</p>
              <div className="grid grid-cols-3 gap-2">
                {moods.map((m) => (
                  <button key={m.value} onClick={() => setHabits({...habits, mood: m.value})}
                    className={`p-3 rounded-xl transition-all ${habits.mood === m.value 
                      ? 'bg-violet-500/30 border-violet-500/50 scale-105' : 'bg-white/5 border-white/10 hover:bg-white/10'} border`}>
                    <span className="text-2xl block mb-1">{m.emoji}</span>
                    <span className="text-xs text-slate-300">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <SliderInput label="Stress Level" icon="😰" value={habits.stress_level} 
              onChange={(v) => setHabits({...habits, stress_level: v})} min={1} max={10} unit="/10" goodRange={[1, 4]} />
            <SliderInput label="Productivity" icon="📈" value={habits.productivity} 
              onChange={(v) => setHabits({...habits, productivity: v})} min={1} max={10} unit="/10" goodRange={[6, 10]} />
          </div>

          <div>
            <h4 className="text-amber-400 font-semibold text-sm uppercase tracking-wide mb-2">📓 Notes</h4>
            <textarea value={habits.notes} onChange={(e) => setHabits({...habits, notes: e.target.value})}
              placeholder="How was your day? Any specific events affecting your wellness?"
              className="w-full p-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:border-violet-500/50 focus:outline-none resize-none"
              rows={3} />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={() => onSave(habits)} className="flex-1 py-3 rounded-xl font-semibold bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white">
            💾 Save Check-in
          </button>
          <button onClick={onClose} className="px-6 py-3 rounded-xl font-semibold bg-white/10 text-white hover:bg-white/20">Cancel</button>
        </div>
      </GlassCard>
    </div>
  );
};

// ============================================
// AI INSIGHTS PANEL
// ============================================
const AIInsightsPanel = ({ faceData, habitData }) => {
  const generateInsights = () => {
    const insights = [];
    if (!faceData || !habitData) {
      return [{ type: 'info', icon: '💡', message: 'Take a face scan and log your habits to get personalized AI insights!' }];
    }

    if (habitData.sleep_hours < 7 && faceData.eye_pouch?.value === 1) {
      insights.push({ type: 'correlation', icon: '😴', message: `Eye bags showing! Only ${habitData.sleep_hours}h sleep. Try 7-8 hours tonight.`, confidence: 'high' });
    }
    if (habitData.sleep_hours >= 8 && faceData.eye_pouch?.value === 0) {
      insights.push({ type: 'positive', icon: '✨', message: '8+ hours of sleep is keeping eye bags away!', confidence: 'high' });
    }
    if (habitData.water_glasses < 6 && faceData.skin_type?.skin_type === 1) {
      insights.push({ type: 'correlation', icon: '💧', message: `Dry skin + only ${habitData.water_glasses} glasses water. Aim for 8+!`, confidence: 'medium' });
    }
    if (habitData.stress_level > 6 && faceData.forehead_wrinkle?.value === 1) {
      insights.push({ type: 'correlation', icon: '😰', message: `High stress (${habitData.stress_level}/10) may cause forehead lines.`, confidence: 'medium' });
    }
    if (habitData.exercise_minutes >= 30) {
      insights.push({ type: 'positive', icon: '💪', message: `${habitData.exercise_minutes}min exercise boosts skin circulation!`, confidence: 'high' });
    }
    if (!insights.length) {
      insights.push({ type: 'positive', icon: '🌟', message: 'Habits look balanced! Keep tracking for more insights.', confidence: 'medium' });
    }
    return insights;
  };

  const insights = generateInsights();
  const typeStyles = {
    correlation: 'bg-violet-500/20 border-violet-500/30',
    positive: 'bg-emerald-500/20 border-emerald-500/30',
    warning: 'bg-amber-500/20 border-amber-500/30',
    info: 'bg-slate-500/20 border-slate-500/30'
  };

  return (
    <GlassCard className="p-6" hover={false}>
      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <span>🤖</span> AI Insights
        <span className="text-xs bg-violet-500/20 text-violet-300 px-2 py-1 rounded-full ml-auto">Beta</span>
      </h3>
      <div className="space-y-3">
        {insights.map((insight, i) => (
          <div key={i} className={`p-4 rounded-xl border ${typeStyles[insight.type]}`}>
            <div className="flex gap-3">
              <span className="text-2xl">{insight.icon}</span>
              <div>
                <p className="text-white text-sm">{insight.message}</p>
                {insight.confidence && <p className="text-slate-500 text-xs mt-1">Confidence: {insight.confidence}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
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
  const [history, setHistory] = useState([]);
  const [cameraStream, setCameraStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [capturedImageUrl, setCapturedImageUrl] = useState(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [notification, setNotification] = useState(null);
  const [showHabitModal, setShowHabitModal] = useState(false);
  const [todayHabits, setTodayHabits] = useState(null);
  const [latestFaceData, setLatestFaceData] = useState(null);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null); // NEW: For viewing historical reports
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const faceDetectionRef = useRef(null);

  const showNotification = useCallback((message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
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
        canvas.width = 100; canvas.height = 100;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, video.videoWidth/2 - 50, video.videoHeight/2 - 50, 100, 100, 0, 0, 100, 100);
        const imageData = ctx.getImageData(0, 0, 100, 100);
        let skinPixels = 0;
        for (let i = 0; i < imageData.data.length; i += 4) {
          const r = imageData.data[i], g = imageData.data[i+1], b = imageData.data[i+2];
          if (r > 60 && g > 40 && b > 20 && r > g && r > b && Math.abs(r-g) > 15 && r-b > 15) skinPixels++;
        }
        setFaceDetected(skinPixels / 10000 > 0.15);
      }
      faceDetectionRef.current = requestAnimationFrame(detectFace);
    };
    detectFace();
  }, [cameraStream]);

  const checkAuth = async () => {
    const token = localStorage.getItem('session_token');
    if (token) {
      try {
        const res = await fetch(`${API_URL}/api/user/profile`, { headers: { 'session-token': token } });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          if (data.recent_analyses?.[0]?.results) setLatestFaceData(data.recent_analyses[0].results);
        } else localStorage.removeItem('session_token');
      } catch (e) { localStorage.removeItem('session_token'); }
    }
    setLoading(false);
  };

  const handleLogin = () => {
    if (!window.google) { showNotification('Loading...', 'warning'); return; }
    window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleResponse });
    window.google.accounts.id.prompt();
  };

  const handleGoogleResponse = async (response) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/google`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('session_token', data.session_token);
        setUser(data.user);
        showNotification('Welcome! 👋', 'success');
        if (!disclaimerAccepted) setShowDisclaimer(true);
      }
    } catch (e) { showNotification('Login failed', 'error'); }
  };

  const startCamera = async () => {
    if (!disclaimerAccepted) { setShowDisclaimer(true); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false 
      });
      setCameraStream(stream);
    } catch (e) { showNotification('Camera access failed', 'error'); }
  };

  const stopCamera = () => {
    if (faceDetectionRef.current) cancelAnimationFrame(faceDetectionRef.current);
    if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); setCameraStream(null); }
    if (videoRef.current) videoRef.current.srcObject = null;
    setFaceDetected(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !faceDetected) return;
    const video = videoRef.current, canvas = canvasRef.current;
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.translate(canvas.width, 0); ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) { setCapturedImage(blob); setCapturedImageUrl(URL.createObjectURL(blob)); stopCamera(); }
    }, 'image/jpeg', 0.95);
  };

  const analyzePhoto = async () => {
    if (!capturedImage) return;
    setUploadLoading(true);
    const formData = new FormData();
    formData.append('image', capturedImage, 'face.jpg');
    try {
      const res = await fetch(`${API_URL}/api/analyze-face`, {
        method: 'POST', headers: { 'session-token': localStorage.getItem('session_token') }, body: formData
      });
      if (res.ok) {
        const data = await res.json();
        setAnalysisResult(data.results);
        setLatestFaceData(data.results);
        setCapturedImage(null); setCapturedImageUrl(null);
        setCurrentView('results');
        setUser(prev => ({ ...prev, total_photos: (prev?.total_photos || 0) + 1 }));
        showNotification('Analysis complete! 🎉', 'success');
      } else {
        const err = await res.json();
        showNotification(err.detail || 'Failed', 'error');
      }
    } catch (e) { showNotification('Failed', 'error'); }
    setUploadLoading(false);
  };

  const saveHabits = async (habits) => {
    try {
      const res = await fetch(`${API_URL}/api/habits/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'session-token': localStorage.getItem('session_token') },
        body: JSON.stringify(habits)
      });
      if (res.ok) {
        setTodayHabits(habits);
        setShowHabitModal(false);
        showNotification('Habits logged! 📝', 'success');
      }
    } catch (e) { showNotification('Failed to save', 'error'); }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/api/analysis/history`, { headers: { 'session-token': localStorage.getItem('session_token') } });
      if (res.ok) { const data = await res.json(); setHistory(data.history || []); }
    } catch (e) {}
  };

  const logout = () => { stopCamera(); localStorage.removeItem('session_token'); setUser(null); setCurrentView('home'); };
  
  const navigate = (view) => {
    if (view !== 'camera') stopCamera();
    setCapturedImage(null); setCapturedImageUrl(null);
    setSelectedHistoryItem(null); // Clear selected history item
    setCurrentView(view);
    if (view === 'history') fetchHistory();
  };

  // NEW: View historical report
  const viewHistoricalReport = (item) => {
    setSelectedHistoryItem(item);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <AnimatedBackground />
      <div className="w-16 h-16 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
    </div>
  );

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <AnimatedBackground />
      <div className="max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-500 to-fuchsia-600 mb-6 shadow-2xl">
          <span className="text-5xl">✨</span>
        </div>
        <h1 className="text-4xl font-bold text-white mb-3">Face Wellness</h1>
        <p className="text-slate-400 text-lg mb-8">See how your habits show on your face</p>
        
        <GlassCard className="p-6 mb-6 text-left" hover={false}>
          <div className="space-y-3">
            {[
              { icon: '📸', title: 'Daily Face Scan', desc: '20+ skin metrics analyzed' },
              { icon: '📝', title: 'Habit Tracking', desc: 'Log sleep, water, exercise, mood' },
              { icon: '🤖', title: 'AI Correlations', desc: 'See how habits affect your face' },
              { icon: '📧', title: 'Weekly Reports', desc: 'Trends & recommendations' }
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-2xl">{f.icon}</span>
                <div>
                  <p className="text-white font-medium text-sm">{f.title}</p>
                  <p className="text-slate-400 text-xs">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        <button onClick={handleLogin} className="w-full py-4 rounded-2xl font-semibold text-white bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 transition-all shadow-xl flex items-center justify-center gap-3">
          <svg className="w-6 h-6" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Continue with Google
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pb-24">
      <AnimatedBackground />
      
      {showDisclaimer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <GlassCard className="max-w-md w-full p-8" hover={false}>
            <h3 className="text-xl font-bold text-white mb-4 text-center">⚠️ Responsible Use</h3>
            <div className="space-y-3 text-sm text-slate-300 mb-6">
              <p>✓ Only upload your own photos</p>
              <p>✓ Use appropriate content only</p>
              <p>✗ No photos of others without consent</p>
            </div>
            <button onClick={() => { localStorage.setItem('disclaimer_accepted', 'true'); setDisclaimerAccepted(true); setShowDisclaimer(false); }}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-semibold">
              I Understand
            </button>
          </GlassCard>
        </div>
      )}

      {showHabitModal && <HabitTrackingModal onSave={saveHabits} onClose={() => setShowHabitModal(false)} existingData={todayHabits} />}

      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-2xl font-medium animate-slide-in-right backdrop-blur-xl border
          ${notification.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' :
            notification.type === 'error' ? 'bg-rose-500/20 border-rose-500/30 text-rose-300' : 'bg-cyan-500/20 border-cyan-500/30 text-cyan-300'}`}>
          {notification.message}
        </div>
      )}

      <header className="sticky top-0 z-40 backdrop-blur-xl bg-slate-950/50 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center">✨</div>
            <span className="text-white font-bold text-xl hidden sm:block">Face Wellness</span>
          </div>
          <div className="flex items-center gap-3">
            <img src={user.picture || ''} alt="" className="w-9 h-9 rounded-full ring-2 ring-violet-500/30" />
            <button onClick={logout} className="text-slate-400 hover:text-white text-sm">Logout</button>
          </div>
        </div>
      </header>

      <nav className="sticky top-[73px] z-30 backdrop-blur-xl bg-slate-950/30 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {[
              { id: 'home', icon: '🏠', label: 'Home' },
              { id: 'camera', icon: '📸', label: 'Scan' },
              { id: 'habits', icon: '📝', label: 'Habits' },
              { id: 'insights', icon: '🤖', label: 'AI' },
              { id: 'history', icon: '📊', label: 'History' }
            ].map((item) => (
              <button key={item.id} onClick={() => item.id === 'habits' ? setShowHabitModal(true) : navigate(item.id)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition-all whitespace-nowrap
                  ${currentView === item.id ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                <span>{item.icon}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {currentView === 'home' && (
          <div className="space-y-6 animate-fade-in">
            <GlassCard className="p-8 text-center" hover={false} glow>
              <StreakFlame streak={user?.current_streak || 0} />
              <h2 className="text-4xl font-bold text-white mt-4">{user?.current_streak || 0} Day Streak</h2>
              <p className="text-slate-400 mt-2 mb-6">{user?.current_streak > 0 ? "Keep it going! 🔥" : "Start today!"}</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button onClick={() => navigate('camera')} className="px-8 py-4 rounded-2xl font-semibold bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white">
                  📸 Take Face Scan
                </button>
                <button onClick={() => setShowHabitModal(true)} className="px-8 py-4 rounded-2xl font-semibold bg-white/10 text-white hover:bg-white/20">
                  📝 Log Today's Habits
                </button>
              </div>
            </GlassCard>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <GlassCard className="p-5 text-center"><p className="text-3xl font-bold text-cyan-400">{user?.total_photos || 0}</p><p className="text-slate-400 text-sm">Scans</p></GlassCard>
              <GlassCard className="p-5 text-center"><p className="text-3xl font-bold text-violet-400">{user?.current_streak || 0}</p><p className="text-slate-400 text-sm">Streak</p></GlassCard>
              <GlassCard className="p-5 text-center"><p className="text-3xl font-bold text-fuchsia-400">{latestFaceData?.skin_age?.value || '—'}</p><p className="text-slate-400 text-sm">Skin Age</p></GlassCard>
              <GlassCard className="p-5 text-center"><p className="text-3xl font-bold text-emerald-400">{todayHabits ? '✓' : '—'}</p><p className="text-slate-400 text-sm">Habits</p></GlassCard>
            </div>

            <AIInsightsPanel faceData={latestFaceData} habitData={todayHabits} />
          </div>
        )}

        {currentView === 'camera' && (
          <div className="max-w-lg mx-auto animate-fade-in">
            <GlassCard className="p-6" hover={false}>
              <h3 className="text-xl font-bold text-white mb-6 text-center">📸 Daily Face Scan</h3>
              
              {!cameraStream && !capturedImage && (
                <div className="text-center py-12">
                  <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center border-2 border-dashed border-white/20">
                    <span className="text-5xl">📸</span>
                  </div>
                  <button onClick={startCamera} className="px-8 py-4 rounded-2xl font-semibold bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white">
                    Open Camera
                  </button>
                </div>
              )}

              {cameraStream && !capturedImage && (
                <div className="space-y-4">
                  <div className="relative rounded-2xl overflow-hidden bg-black aspect-[3/4]">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className={`w-48 h-64 border-2 rounded-full transition-all ${faceDetected ? 'border-emerald-400' : 'border-white/30'}`} />
                    </div>
                    <div className={`absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-sm ${faceDetected ? 'bg-emerald-500/80' : 'bg-amber-500/80'} text-white`}>
                      {faceDetected ? '✓ Face Detected' : '👤 Position face'}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={capturePhoto} disabled={!faceDetected} className={`flex-1 py-4 rounded-xl font-semibold ${faceDetected ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                      {faceDetected ? '📷 Capture' : '⏳ Waiting...'}
                    </button>
                    <button onClick={stopCamera} className="px-6 py-4 rounded-xl bg-white/10 text-white">Cancel</button>
                  </div>
                </div>
              )}

              {capturedImage && (
                <div className="space-y-4">
                  <div className="relative rounded-2xl overflow-hidden bg-black aspect-[3/4]">
                    <img src={capturedImageUrl} alt="Captured" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={analyzePhoto} disabled={uploadLoading} className="flex-1 py-4 rounded-xl font-semibold bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white disabled:opacity-50">
                      {uploadLoading ? '⏳ Analyzing...' : '🔬 Analyze'}
                    </button>
                    <button onClick={() => { setCapturedImage(null); startCamera(); }} className="px-6 py-4 rounded-xl bg-white/10 text-white">Retake</button>
                  </div>
                </div>
              )}
              
              <canvas ref={canvasRef} className="hidden" />
            </GlassCard>
          </div>
        )}

        {currentView === 'results' && (
          <div className="max-w-3xl mx-auto">
            <FullResultsDisplay 
              results={analysisResult} 
              date={new Date().toISOString()} 
              habits={todayHabits}
              onClose={() => navigate('home')} 
              isHistorical={false} 
            />
          </div>
        )}

        {currentView === 'insights' && (
          <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
            <AIInsightsPanel faceData={latestFaceData} habitData={todayHabits} />
          </div>
        )}

        {currentView === 'history' && (
          <div className="max-w-3xl mx-auto animate-fade-in">
            {/* Show full report if an item is selected */}
            {selectedHistoryItem ? (
              <FullResultsDisplay 
                results={selectedHistoryItem.results} 
                date={selectedHistoryItem.timestamp}
                habits={selectedHistoryItem.habits}
                onClose={() => setSelectedHistoryItem(null)} 
                isHistorical={true} 
              />
            ) : (
              /* Show history list */
              <GlassCard className="p-6" hover={false}>
                <h3 className="text-2xl font-bold text-white mb-2">📊 Scan History</h3>
                <p className="text-slate-400 text-sm mb-6">Click on any scan to view the full report</p>
                
                {history.length > 0 ? (
                  <div className="space-y-3">
                    {history.map((item, i) => (
                      <div 
                        key={i} 
                        onClick={() => viewHistoricalReport(item)}
                        className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-violet-500/30 transition-all cursor-pointer group"
                      >
                        <div className="flex justify-between items-center mb-3">
                          <div className="flex items-center gap-3">
                            <span className="text-white font-medium">
                              {new Date(item.timestamp).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </span>
                            <span className="text-xs text-slate-500">
                              {new Date(item.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-300">✓ Analyzed</span>
                            <span className="text-violet-400 opacity-0 group-hover:opacity-100 transition-opacity">View →</span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-4 gap-2 text-sm text-center">
                          <div className="p-2 rounded-lg bg-white/5">
                            <p className="text-slate-400 text-xs">Age</p>
                            <p className="text-white font-bold">{item.results?.skin_age?.value || '—'}</p>
                          </div>
                          <div className="p-2 rounded-lg bg-white/5">
                            <p className="text-slate-400 text-xs">Eye Bags</p>
                            <p className={`font-bold ${item.results?.eye_pouch?.value ? 'text-amber-400' : 'text-emerald-400'}`}>
                              {item.results?.eye_pouch?.value ? 'Yes' : 'No'}
                            </p>
                          </div>
                          <div className="p-2 rounded-lg bg-white/5">
                            <p className="text-slate-400 text-xs">Dark Circles</p>
                            <p className={`font-bold ${item.results?.dark_circle?.value > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                              {item.results?.dark_circle?.value > 0 ? 'Yes' : 'No'}
                            </p>
                          </div>
                          <div className="p-2 rounded-lg bg-white/5">
                            <p className="text-slate-400 text-xs">Blackheads</p>
                            <p className="text-white font-bold">
                              {['None', 'Mild', 'Mod', 'Severe'][item.results?.blackhead?.value] || '—'}
                            </p>
                          </div>
                        </div>
                        
                        {item.habits && (
                          <div className="mt-3 pt-3 border-t border-white/5 flex gap-4 text-xs text-slate-400">
                            <span>😴 {item.habits.sleep_hours}h sleep</span>
                            <span>💧 {item.habits.water_glasses} glasses</span>
                            <span>💪 {item.habits.exercise_minutes}m exercise</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <span className="text-5xl mb-4 block">📊</span>
                    <p className="text-slate-400">No scans yet</p>
                    <button onClick={() => navigate('camera')} className="mt-4 px-6 py-2 rounded-xl bg-violet-500/20 text-violet-300 hover:bg-violet-500/30">
                      Take Your First Scan
                    </button>
                  </div>
                )}
              </GlassCard>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
