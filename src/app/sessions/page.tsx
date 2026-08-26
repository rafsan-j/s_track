"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { AppSidebar } from "@/components/AppSidebar";

export default function StudySessionsPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);

  // Form Data
  const [courses, setCourses] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState("");
  const [notes, setNotes] = useState("");

  // Timer State
  const [timeElapsed, setTimeElapsed] = useState(0); // in seconds
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Recent Sessions
  const [recentSessions, setRecentSessions] = useState<any[]>([]);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        fetchCourses();
        fetchRecentSessions(user.id);
      }
    }
    init();
    
    // Cleanup timer on unmount
    return () => clearInterval(timerRef.current as NodeJS.Timeout);
  }, []);

  async function fetchCourses() {
    const { data } = await supabase.from("courses").select("*").eq("status", "active").order("name");
    setCourses(data || []);
    if (data && data.length > 0) {
      setSelectedCourseId(data[0].id);
      fetchTopics(data[0].id);
    }
  }

  async function fetchTopics(courseId: string) {
    const { data } = await supabase.from("topics")
      .select("*, modules!inner(course_id)")
      .eq("modules.course_id", courseId)
      .order("title");
    setTopics(data || []);
    setSelectedTopicId(data && data.length > 0 ? data[0].id : "");
  }

  async function fetchRecentSessions(uid: string) {
    const { data } = await supabase.from("study_sessions")
      .select("*, courses(name), topics(title)")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(5);
    setRecentSessions(data || []);
  }

  const handleCourseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCourseId(e.target.value);
    fetchTopics(e.target.value);
  };

  // --- Timer Controls ---
  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleStart = () => {
    setIsActive(true);
    setIsPaused(false);
    setSessionStartTime(new Date());
    timerRef.current = setInterval(() => {
      setTimeElapsed((prevTime) => prevTime + 1);
    }, 1000);
  };

  const handlePause = () => {
    setIsPaused(true);
    clearInterval(timerRef.current as NodeJS.Timeout);
  };

  const handleResume = () => {
    setIsPaused(false);
    timerRef.current = setInterval(() => {
      setTimeElapsed((prevTime) => prevTime + 1);
    }, 1000);
  };

  const handleFinish = async () => {
    clearInterval(timerRef.current as NodeJS.Timeout);
    
    if (!userId || !selectedCourseId || !sessionStartTime) return;

    const durationMinutes = Math.floor(timeElapsed / 60);
    
    // Only save if it's at least 1 minute (optional constraint, but good practice)
    if (durationMinutes < 1) {
      if(confirm("This session was less than 1 minute. Discard it?")) {
        resetTimer();
        return;
      }
    }

    const { error } = await supabase.from("study_sessions").insert({
      user_id: userId,
      course_id: selectedCourseId,
      topic_id: selectedTopicId || null,
      start_time: sessionStartTime.toISOString(),
      end_time: new Date().toISOString(),
      duration_minutes: durationMinutes,
      notes: notes
    });

    if (!error) {
      alert(`Session saved! You studied for ${durationMinutes} minutes.`);
      resetTimer();
      fetchRecentSessions(userId);
    } else {
      alert("Error saving session: " + error.message);
    }
  };

  const resetTimer = () => {
    setIsActive(false);
    setIsPaused(false);
    setTimeElapsed(0);
    setNotes("");
    setSessionStartTime(null);
  };

  if (!userId) return <div className="p-8 text-slate-100">Please log in.</div>;

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-300 font-sans">
      <AppSidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        <header className="mb-8">
          <h2 className="text-3xl font-bold text-slate-100">Study Timer</h2>
          <p className="text-slate-400 mt-2">Track your focus sessions and log your time.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Timer Card */}
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-lg flex flex-col items-center">
            
            {/* Setup Form (Hidden while timer is running) */}
            {!isActive && (
              <div className="w-full space-y-4 mb-8">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Course to Study</label>
                  <select value={selectedCourseId} onChange={handleCourseChange} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 outline-none">
                    {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Topic (Optional)</label>
                  <select value={selectedTopicId} onChange={(e) => setSelectedTopicId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 outline-none">
                    <option value="">General Study</option>
                    {topics.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                </div>
              </div>
            )}

            {/* The Stopwatch */}
            <div className={`text-6xl md:text-7xl font-mono font-bold tracking-wider mb-8 transition-colors ${isActive && !isPaused ? 'text-blue-400' : 'text-slate-200'}`}>
              {formatTime(timeElapsed)}
            </div>

            {/* Controls */}
            <div className="flex gap-4 w-full justify-center">
              {!isActive ? (
                <button onClick={handleStart} disabled={courses.length === 0} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-full font-bold text-lg transition-colors w-full max-w-xs shadow-lg shadow-blue-900/20 disabled:opacity-50">
                  Start Session
                </button>
              ) : (
                <>
                  {isPaused ? (
                    <button onClick={handleResume} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-full font-bold transition-colors w-1/2">
                      Resume
                    </button>
                  ) : (
                    <button onClick={handlePause} className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2 rounded-full font-bold transition-colors w-1/2">
                      Pause
                    </button>
                  )}
                  <button onClick={handleFinish} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-full font-bold transition-colors w-1/2">
                    Finish & Log
                  </button>
                </>
              )}
            </div>

            {/* Notes Input (Shown when paused or before finishing) */}
            {isActive && (
              <div className="w-full mt-8">
                <label className="block text-sm text-slate-400 mb-1">Session Notes (Optional)</label>
                <textarea 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What did you accomplish?"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 outline-none text-sm resize-none h-20"
                ></textarea>
              </div>
            )}
          </div>

          {/* Recent Sessions List */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg h-fit">
            <h3 className="text-xl font-semibold text-slate-200 mb-4">Recent Sessions</h3>
            {recentSessions.length === 0 ? (
              <p className="text-slate-500 italic">No study sessions logged yet. Start the timer!</p>
            ) : (
              <div className="space-y-4">
                {recentSessions.map(session => (
                  <div key={session.id} className="bg-slate-950 border border-slate-800 p-4 rounded hover:border-slate-700 transition-colors">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-bold text-slate-200">{session.courses?.name}</h4>
                      <span className="text-xs font-bold bg-blue-900/30 text-blue-400 px-2 py-1 rounded">
                        {session.duration_minutes} min
                      </span>
                    </div>
                    {session.topics?.title && (
                      <p className="text-sm text-slate-400 mb-2">{session.topics.title}</p>
                    )}
                    {session.notes && (
                      <p className="text-sm text-slate-300 italic border-l-2 border-slate-700 pl-2 mt-2">"{session.notes}"</p>
                    )}
                    <p className="text-xs text-slate-500 mt-2 text-right">
                      {new Date(session.start_time).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}