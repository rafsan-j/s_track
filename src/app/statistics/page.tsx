"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { AppSidebar } from "@/components/AppSidebar";

export default function StatisticsPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Stats State
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [monthlyMinutes, setMonthlyMinutes] = useState(0);
  const [weeklyMinutes, setWeeklyMinutes] = useState(0);
  const [completedResourcesCount, setCompletedResourcesCount] = useState(0);
  const [completedTopicsCount, setCompletedTopicsCount] = useState(0);
  
  // Chart State
  const [weeklyData, setWeeklyData] = useState<{ day: string; minutes: number }[]>([]);
  const [maxChartMinutes, setMaxChartMinutes] = useState(1); // Default to 1 to avoid divide-by-zero

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        await calculateStats(user.id);
      }
      setLoading(false);
    }
    init();
  }, []);

  async function calculateStats(uid: string) {
    const now = new Date();
    
    // Time thresholds
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 1. Fetch Study Sessions
    const { data: sessions } = await supabase
      .from("study_sessions")
      .select("duration_minutes, start_time")
      .eq("user_id", uid);

    let total = 0;
    let monthly = 0;
    let weekly = 0;

    // Structure for our 7-day chart
    const daysArr = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(now.getTime() - (6 - i) * 24 * 60 * 60 * 1000);
      return { 
        dateString: d.toISOString().split('T')[0], 
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        minutes: 0 
      };
    });

    if (sessions) {
      sessions.forEach(session => {
        const sessionDate = new Date(session.start_time);
        const mins = session.duration_minutes;
        
        total += mins;
        
        if (sessionDate >= thirtyDaysAgo) {
          monthly += mins;
        }
        
        if (sessionDate >= sevenDaysAgo) {
          weekly += mins;
        }

        // Add to daily chart data
        const dateStr = sessionDate.toISOString().split('T')[0];
        const dayMatch = daysArr.find(d => d.dateString === dateStr);
        if (dayMatch) {
          dayMatch.minutes += mins;
        }
      });
    }

    setTotalMinutes(total);
    setMonthlyMinutes(monthly);
    setWeeklyMinutes(weekly);
    
    // Find max value for chart scaling (at least 60 mins to make the chart look normal if low)
    const highestDay = Math.max(...daysArr.map(d => d.minutes));
    setMaxChartMinutes(highestDay > 60 ? highestDay : 60);
    
    setWeeklyData(daysArr.map(d => ({ day: d.dayName, minutes: d.minutes })));

    // 2. Fetch Resources to calculate completion
    const { data: resources } = await supabase
      .from("resources")
      .select("id, status, topic_id")
      .eq("user_id", uid);

    if (resources) {
      const completedRes = resources.filter(r => r.status === 'completed');
      setCompletedResourcesCount(completedRes.length);

      // Calculate fully completed topics
      // A topic is complete if all its resources are completed or skipped
      const topicsMap = new Map();
      resources.forEach(r => {
        if (!topicsMap.has(r.topic_id)) topicsMap.set(r.topic_id, { total: 0, done: 0 });
        const t = topicsMap.get(r.topic_id);
        t.total += 1;
        if (r.status === 'completed' || r.status === 'skipped') t.done += 1;
      });

      let completedTopics = 0;
      topicsMap.forEach((val) => {
        if (val.total > 0 && val.total === val.done) completedTopics += 1;
      });
      setCompletedTopicsCount(completedTopics);
    }
  }

  // Formatting helper
  const formatHours = (mins: number) => {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  if (loading) return <div className="p-8 text-slate-400">Loading statistics...</div>;
  if (!userId) return <div className="p-8 text-slate-100">Please log in.</div>;

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-300 font-sans">
      <AppSidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        <header className="mb-8">
          <h2 className="text-3xl font-bold text-slate-100">Analytics</h2>
          <p className="text-slate-400 mt-2">Track your learning velocity over time.</p>
        </header>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg">
            <h3 className="text-sm font-medium text-slate-400 mb-1">Total Study Time</h3>
            <p className="text-3xl font-bold text-white">{formatHours(totalMinutes)}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg">
            <h3 className="text-sm font-medium text-slate-400 mb-1">Last 30 Days</h3>
            <p className="text-3xl font-bold text-blue-400">{formatHours(monthlyMinutes)}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg">
            <h3 className="text-sm font-medium text-slate-400 mb-1">Last 7 Days</h3>
            <p className="text-3xl font-bold text-green-400">{formatHours(weeklyMinutes)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Last 7 Days Activity Chart */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-slate-200 mb-6">Study Activity (Last 7 Days)</h3>
            
            <div className="h-64 flex items-end justify-between gap-2 mt-4 relative pt-6">
              {/* Background grid lines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[10px] text-slate-600">
                <div className="flex w-full items-center border-b border-slate-800/50 pb-1"><span>{formatHours(maxChartMinutes)}</span></div>
                <div className="flex w-full items-center border-b border-slate-800/50 pb-1"><span>{formatHours(Math.floor(maxChartMinutes * 0.5))}</span></div>
                <div className="flex w-full items-center border-b border-slate-800/50 pb-1"><span>0m</span></div>
              </div>

              {/* Chart Bars */}
              {weeklyData.map((d, i) => {
                const heightPercentage = Math.max((d.minutes / maxChartMinutes) * 100, 2); // At least 2% height so the bar is visible
                
                return (
                  <div key={i} className="flex flex-col items-center flex-1 z-10 group">
                    <div className="w-full flex justify-center h-52 items-end">
                      <div 
                        className={`w-full max-w-[40px] rounded-t-sm transition-all duration-500 ease-out ${d.minutes > 0 ? 'bg-blue-600 group-hover:bg-blue-500' : 'bg-slate-800'}`}
                        style={{ height: `${d.minutes === 0 ? 2 : heightPercentage}%` }}
                      >
                        {/* Tooltip on hover */}
                        <div className="opacity-0 group-hover:opacity-100 absolute -mt-8 -ml-2 bg-slate-800 text-white text-xs py-1 px-2 rounded pointer-events-none transition-opacity">
                          {d.minutes}m
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 mt-3 font-medium">{d.day}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Curriculum Stats */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg h-fit">
            <h3 className="text-lg font-semibold text-slate-200 mb-6">Curriculum Milestones</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-slate-950 border border-slate-800 p-4 rounded-lg">
                <div>
                  <h4 className="font-medium text-slate-200">Resources Conquered</h4>
                  <p className="text-xs text-slate-500 mt-1">Total videos and websites marked as completed.</p>
                </div>
                <div className="text-3xl font-bold text-indigo-400">{completedResourcesCount}</div>
              </div>

              <div className="flex items-center justify-between bg-slate-950 border border-slate-800 p-4 rounded-lg">
                <div>
                  <h4 className="font-medium text-slate-200">Topics Mastered</h4>
                  <p className="text-xs text-slate-500 mt-1">Topics where 100% of resources are completed.</p>
                </div>
                <div className="text-3xl font-bold text-purple-400">{completedTopicsCount}</div>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}