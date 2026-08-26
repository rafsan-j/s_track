"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import Link from "next/link";
import { AppSidebar } from "@/components/AppSidebar";
import { ArrowUpRight, BookOpen, CheckCircle2, Circle } from "lucide-react";

export default function Dashboard() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Data states
  const [currentSemester, setCurrentSemester] = useState<any>(null);
  const [resumeQueue, setResumeQueue] = useState<any[]>([]);
  
  // New Progress States
  const [semesterProgress, setSemesterProgress] = useState(0);
  const [courseProgresses, setCourseProgresses] = useState<any[]>([]);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        await loadDashboardData();
      }
      setLoading(false);
    }
    init();
  }, []);

  async function loadDashboardData() {
    // 1. Get the most recently created semester
    const { data: semesters } = await supabase
      .from("semesters")
      .select("*, academic_years(name)")
      .order("created_at", { ascending: false })
      .limit(1);

    if (!semesters || semesters.length === 0) return;
    const activeSem = semesters[0];
    setCurrentSemester(activeSem);

    // 2. Fetch all active courses for this semester
    const { data: courses } = await supabase
      .from("courses")
      .select("*")
      .eq("semester_id", activeSem.id)
      .eq("status", "active");

    if (!courses || courses.length === 0) return;

    // --- NEW: Calculate Overall Progress ---
    const courseIds = courses.map(c => c.id);
    
    // Fetch all topics and resources for the entire semester in just two queries
    const [topicsRes, resourcesRes] = await Promise.all([
      supabase.from("topics").select("*, modules!inner(course_id)").in("modules.course_id", courseIds),
      supabase.from("resources").select("*, topics!inner(modules!inner(course_id))").in("topics.modules.course_id", courseIds)
    ]);

    const topics = topicsRes.data || [];
    const resources = resourcesRes.data || [];

    let totalSemesterProgress = 0;
    const progressArray = [];

    for (const course of courses) {
      const courseTopics = topics.filter(t => t.modules.course_id === course.id);
      let courseProg = 0;

      if (courseTopics.length > 0) {
        let totalTopicProg = 0;
        for (const topic of courseTopics) {
          const topicResources = resources.filter(r => r.topic_id === topic.id);
          if (topicResources.length > 0) {
            const completed = topicResources.filter(r => r.status === 'completed' || r.status === 'skipped').length;
            totalTopicProg += (completed / topicResources.length) * 100;
          }
        }
        courseProg = Math.round(totalTopicProg / courseTopics.length);
      }

      progressArray.push({
        id: course.id,
        name: course.name,
        progress: courseProg
      });
      totalSemesterProgress += courseProg;
    }

    setCourseProgresses(progressArray);
    setSemesterProgress(Math.round(totalSemesterProgress / courses.length));

    // --- EXISTING: Calculate Resume Queue ---
    const queue = [];
    for (const course of courses) {
      const { data: latestResource } = await supabase
        .from("resources")
        .select("*, topics!inner(title, modules!inner(course_id))")
        .eq("topics.modules.course_id", course.id)
        .order("last_accessed_at", { ascending: false })
        .limit(1)
        .single();

      if (latestResource) {
        queue.push({
          courseName: course.name,
          courseId: course.id,
          topicTitle: latestResource.topics.title,
          resourceTitle: latestResource.title,
          resourceUrl: latestResource.url,
          lastAccessed: new Date(latestResource.last_accessed_at)
        });
      }
    }

    queue.sort((a, b) => b.lastAccessed.getTime() - a.lastAccessed.getTime());
    setResumeQueue(queue);
  }

  if (loading) return <div className="p-8 text-slate-400">Loading dashboard...</div>;
  if (!userId) return <div className="p-8 text-slate-100">Please <Link href="/login" className="text-blue-400 underline">log in</Link> first.</div>;

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-300 font-sans">
      <AppSidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        <header className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-blue-400">Overview</p>
            <h2 className="text-3xl font-bold tracking-tight text-slate-100">Your semester</h2>
          </div>
          
          {resumeQueue.length > 0 && (
            <a 
              href={resumeQueue[0].resourceUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="hidden items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-900/20 transition-colors hover:bg-blue-700 md:inline-flex"
            >
              <BookOpen size={16} aria-hidden="true" />
              Resume study
              <ArrowUpRight size={15} aria-hidden="true" />
            </a>
          )}
        </header>

        {!currentSemester ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center">
            <h3 className="text-lg font-medium text-slate-200 mb-2">No Setup Found</h3>
            <p className="text-slate-400 mb-4">You need to create an Academic Year and Semester first.</p>
            <Link href="/manage" className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded transition-colors">Go to Settings</Link>
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* Progress Section */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.6fr)]">
              {/* Overall Semester Progress Card */}
              <div className="relative min-h-[172px] overflow-hidden rounded-xl border border-slate-800 bg-slate-900 p-6">
                <div className="relative z-10 pr-28">
                  <p className="text-sm font-medium text-slate-400">{currentSemester.name}</p>
                  <div className="mt-5 flex items-end gap-2">
                    <span className="text-5xl font-bold tracking-tight text-blue-400">{semesterProgress}</span>
                    <span className="mb-1 text-sm text-slate-500">%</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-400">semester progress</p>
                </div>
                <div className="absolute right-5 top-1/2 h-28 w-28 -translate-y-1/2" aria-hidden="true">
                  <svg viewBox="0 0 112 112" className="h-full w-full -rotate-90">
                    <circle cx="56" cy="56" r="48" fill="none" stroke="rgb(30 41 59 / 0.8)" strokeWidth="10" />
                    <circle
                      cx="56"
                      cy="56"
                      r="48"
                      fill="none"
                      stroke="rgb(96 165 250)"
                      strokeLinecap="round"
                      strokeWidth="10"
                      strokeDasharray="301.59"
                      strokeDashoffset={301.59 - (301.59 * semesterProgress) / 100}
                      className="transition-[stroke-dashoffset] duration-700 ease-out"
                    />
                  </svg>
                </div>
              </div>

              {/* Individual Course Progress Bars */}
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
                <div className="mb-5 flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">Courses</h3>
                  <span className="text-xs text-slate-600">{courseProgresses.length} active</span>
                </div>
                <div className="space-y-4">
                  {courseProgresses.map(course => (
                    <div key={course.id}>
                      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                        <span className="truncate font-medium text-slate-200">{course.name}</span>
                        <span className="shrink-0 tabular-nums text-slate-400">{course.progress}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-950">
                        <div className="h-full rounded-full bg-blue-400 transition-all duration-1000" style={{ width: `${course.progress}%` }}></div>
                      </div>
                    </div>
                  ))}
                  {courseProgresses.length === 0 && (
                    <p className="text-slate-500 italic text-sm">No courses added yet.</p>
                  )}
                </div>
              </div>
            </div>
            
            {/* Resume Queue Section */}
            <div>
              <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">Continue</h3>
                <BookOpen size={18} className="text-slate-600" aria-hidden="true" />
              </div>
              {resumeQueue.length === 0 ? (
                <p className="text-slate-500 italic">No resources tracked yet. Add some resources and update their status in the Study Workspace.</p>
              ) : (
                <div className="divide-y divide-slate-800/80 overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
                  {resumeQueue.map((item, index) => (
                    <div key={item.courseId} className={`flex items-center gap-4 p-4 transition-colors hover:bg-slate-800/40 ${index === 0 ? 'bg-blue-500/[0.04]' : ''}`}>
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-blue-400">
                        {index === 0 ? <CheckCircle2 size={18} aria-hidden="true" /> : <Circle size={18} aria-hidden="true" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="truncate text-sm font-semibold text-slate-200">{item.courseName}</h4>
                          {index === 0 && <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-blue-400">Latest</span>}
                        </div>
                        <p className="mt-1 truncate text-xs text-slate-500">{item.topicTitle} · {item.resourceTitle}</p>
                      </div>
                        <a 
                          href={item.resourceUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700"
                        >
                          Open <ArrowUpRight size={14} aria-hidden="true" />
                        </a>
                        <Link
                          href="/study" 
                          aria-label={`Open workspace for ${item.courseName}`}
                          className="hidden rounded-lg bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700 sm:inline-flex"
                        >
                          Workspace
                        </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
          </div>
        )}
      </main>
    </div>
  );
}