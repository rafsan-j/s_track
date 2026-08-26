"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { AppSidebar } from "@/components/AppSidebar";
import { BookOpen, CheckCircle2, CircleDashed, Layers3 } from "lucide-react";

export default function StudyPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);

  // Data states
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  
  // Curriculum state
  const [modules, setModules] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        fetchCourses();
      }
    }
    init();
  }, []);

  async function fetchCourses() {
    const { data } = await supabase.from("courses").select("*").eq("status", "active").order("created_at", { ascending: false });
    if (data && data.length > 0) {
      setCourses(data);
      setSelectedCourseId(data[0].id);
      fetchCurriculum(data[0].id);
    }
  }

  async function fetchCurriculum(courseId: string) {
    // Fetch all modules, topics, and resources for this course in parallel
    const [modulesRes, topicsRes, resourcesRes] = await Promise.all([
      supabase.from("modules").select("*").eq("course_id", courseId).order("display_order", { ascending: true }),
      supabase.from("topics").select("*, modules!inner(course_id)").eq("modules.course_id", courseId),
      supabase.from("resources").select("*, topics!inner(modules!inner(course_id))").eq("topics.modules.course_id", courseId)
    ]);

    setModules(modulesRes.data || []);
    setTopics(topicsRes.data || []);
    setResources(resourcesRes.data || []);
  }

  const handleCourseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCourseId(e.target.value);
    fetchCurriculum(e.target.value);
  };

  // Update resource status in database
  async function updateResourceStatus(resourceId: string, newStatus: string) {
    // Optimistic UI update (feels faster to the user)
    setResources(resources.map(r => r.id === resourceId ? { ...r, status: newStatus } : r));

    // Update database, and touch the last_accessed_at timestamp!
    await supabase.from("resources").update({ 
      status: newStatus,
      last_accessed_at: new Date().toISOString()
    }).eq("id", resourceId);
  }

  // --- Progress Calculations ---
  function getTopicProgress(topicId: string) {
    const topicResources = resources.filter(r => r.topic_id === topicId);
    if (topicResources.length === 0) return 0;
    const completed = topicResources.filter(r => r.status === 'completed' || r.status === 'skipped').length;
    return Math.round((completed / topicResources.length) * 100);
  }

  function getCourseProgress() {
    if (topics.length === 0) return 0;
    const totalProgress = topics.reduce((sum, topic) => sum + getTopicProgress(topic.id), 0);
    return Math.round(totalProgress / topics.length);
  }

  if (!userId) return <div className="p-8 text-slate-100">Please log in.</div>;

  const courseProgress = getCourseProgress();

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-300">
      <AppSidebar />
      <div className="flex-1 p-8 max-w-6xl mx-auto">
      <header className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-blue-400">Learning path</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-100">Study Workspace</h1>
        </div>
        <label className="w-full md:w-72">
          <span className="sr-only">Select course</span>
          <select value={selectedCourseId} onChange={handleCourseChange} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm font-medium text-slate-100 outline-none transition-colors focus:border-blue-500">
            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      </header>

      {/* Course Overall Progress */}
      <div className="mb-10 border-b border-slate-800 pb-7">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
            <BookOpen size={16} className="text-blue-400" aria-hidden="true" />
            Course progress
          </div>
          <span className="text-2xl font-bold tabular-nums text-blue-400">{courseProgress}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-950">
          <div className="h-full rounded-full bg-blue-500 transition-all duration-500 ease-in-out" style={{ width: `${courseProgress}%` }}></div>
        </div>
      </div>

      {/* Curriculum Render */}
      <div className="space-y-8">
        {modules.map(module => (
          <section key={module.id} className="border-b border-slate-800/80 pb-8 last:border-b-0">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                <Layers3 size={16} aria-hidden="true" />
              </div>
              <h3 className="text-lg font-bold text-slate-100">{module.title}</h3>
            </div>
            
            <div className="space-y-6 pl-2 md:pl-11">
              {topics.filter(t => t.module_id === module.id).map(topic => {
                const topicProgress = getTopicProgress(topic.id);
                const topicResources = resources.filter(r => r.topic_id === topic.id);
                
                return (
                  <div key={topic.id}>
                    <div className="mb-3 flex items-center justify-between gap-4">
                      <h4 className="truncate font-semibold text-slate-200">{topic.title}</h4>
                      <span className="shrink-0 text-xs font-medium tabular-nums text-slate-500">{topicProgress}%</span>
                    </div>
                    
                    {topicResources.length === 0 ? (
                      <p className="text-sm text-slate-500 italic">No resources added yet.</p>
                    ) : (
                      <div className="divide-y divide-slate-800/80 border-y border-slate-800/80">
                        {topicResources.map(resource => (
                          <div key={resource.id} className="flex flex-col gap-3 py-3 transition-colors hover:bg-slate-900/60 md:flex-row md:items-center md:justify-between">
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                              {resource.status === 'completed' ? <CheckCircle2 size={17} className="shrink-0 text-emerald-400" aria-hidden="true" /> : <CircleDashed size={17} className="shrink-0 text-slate-600" aria-hidden="true" />}
                              <a href={resource.url} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate text-sm font-medium text-slate-200 transition-colors hover:text-blue-400">
                                {resource.title}
                              </a>
                              <span className="hidden shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-600 sm:inline">
                                {resource.type.replace('_', ' ')}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-3">
                              <select 
                                value={resource.status}
                                onChange={(e) => updateResourceStatus(resource.id, e.target.value)}
                                aria-label={`Update status for ${resource.title}`}
                                className={`rounded-lg border px-2 py-1.5 text-xs outline-none transition-colors ${
                                  resource.status === 'completed' ? 'bg-green-900/20 border-green-900 text-green-400' :
                                  resource.status === 'in_progress' ? 'bg-blue-900/20 border-blue-900 text-blue-400' :
                                  'bg-slate-900 border-slate-700 text-slate-300'
                                }`}
                              >
                                <option value="not_started">Not Started</option>
                                <option value="in_progress">In Progress</option>
                                <option value="completed">Completed</option>
                                <option value="skipped">Skipped</option>
                              </select>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        ))}
        {modules.length === 0 && (
          <div className="text-center py-12 border border-slate-800 border-dashed rounded-lg text-slate-500">
            No curriculum found. Build it in the Manage tab!
          </div>
        )}
      </div>
      </div>
    </div>
  );
}