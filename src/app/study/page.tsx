"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { AppSidebar } from "@/components/AppSidebar";

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
        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Study Workspace</h1>
          <p className="text-slate-400">Track your progress and access your materials.</p>
        </div>
        <div className="w-full md:w-64">
          <select value={selectedCourseId} onChange={handleCourseChange} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100 outline-none font-medium text-lg shadow-sm">
            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </header>

      {/* Course Overall Progress */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg mb-8 shadow-sm">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-semibold text-slate-200">Course Completion</h2>
          <span className="text-2xl font-bold text-blue-400">{courseProgress}%</span>
        </div>
        <div className="w-full bg-slate-950 rounded-full h-3 border border-slate-800">
          <div className="bg-blue-600 h-3 rounded-full transition-all duration-500 ease-in-out" style={{ width: `${courseProgress}%` }}></div>
        </div>
      </div>

      {/* Curriculum Render */}
      <div className="space-y-8">
        {modules.map(module => (
          <div key={module.id} className="bg-slate-900/50 border border-slate-800 rounded-lg overflow-hidden">
            <div className="bg-slate-800/50 px-6 py-4 border-b border-slate-800">
              <h3 className="text-xl font-bold text-slate-200">{module.title}</h3>
            </div>
            
            <div className="p-6 space-y-6">
              {topics.filter(t => t.module_id === module.id).map(topic => {
                const topicProgress = getTopicProgress(topic.id);
                const topicResources = resources.filter(r => r.topic_id === topic.id);
                
                return (
                  <div key={topic.id} className="border-l-2 border-blue-900/50 pl-4">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-semibold text-slate-300 text-lg">{topic.title}</h4>
                      <span className="text-xs font-medium bg-slate-950 px-2 py-1 rounded text-slate-400 border border-slate-800">
                        {topicProgress}%
                      </span>
                    </div>
                    
                    {topicResources.length === 0 ? (
                      <p className="text-sm text-slate-500 italic">No resources added yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {topicResources.map(resource => (
                          <div key={resource.id} className="flex flex-col md:flex-row md:items-center justify-between bg-slate-950 border border-slate-800 p-3 rounded gap-4 hover:border-slate-700 transition-colors">
                            <div className="flex-1">
                              <a href={resource.url} target="_blank" rel="noopener noreferrer" className="font-medium text-slate-200 hover:text-blue-400 transition-colors block mb-1">
                                {resource.title}
                              </a>
                              <span className="text-[10px] uppercase font-bold text-slate-500">
                                {resource.type.replace('_', ' ')}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-3">
                              <select 
                                value={resource.status}
                                onChange={(e) => updateResourceStatus(resource.id, e.target.value)}
                                className={`text-sm rounded px-2 py-1 outline-none border transition-colors ${
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
          </div>
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