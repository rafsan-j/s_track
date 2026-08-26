"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { AppSidebar } from "@/components/AppSidebar";

export default function ManageResourcesPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);

  // Data states
  const [years, setYears] = useState<any[]>([]);
  const [semesters, setSemesters] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [modules, setModules] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);

  // Selection states
  const [selectedYearId, setSelectedYearId] = useState("");
  const [selectedSemesterId, setSelectedSemesterId] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState("");

  // Form states
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const [resourceType, setResourceType] = useState("youtube_video");

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        fetchYears();
      }
    }
    init();
  }, []);

  // --- Cascading Fetch Functions ---
  async function fetchYears() {
    const { data } = await supabase.from("academic_years").select("*").order("created_at", { ascending: false });
    setYears(data || []);
    if (data && data.length > 0) {
      setSelectedYearId(data[0].id);
      fetchSemesters(data[0].id);
    } else {
      setSelectedYearId("");
      setSemesters([]);
      setSelectedSemesterId("");
      resetDownstream("semester");
    }
  }

  async function fetchSemesters(yearId: string) {
    const { data } = await supabase.from("semesters").select("*").eq("academic_year_id", yearId).order("created_at", { ascending: false });
    setSemesters(data || []);
    if (data && data.length > 0) {
      setSelectedSemesterId(data[0].id);
      fetchCourses(data[0].id);
    } else {
      setSelectedSemesterId("");
      resetDownstream("semester");
    }
  }

  async function fetchCourses(semesterId: string) {
    const { data } = await supabase.from("courses").select("*").eq("semester_id", semesterId).eq("status", "active").order("created_at", { ascending: false });
    setCourses(data || []);
    if (data && data.length > 0) {
      setSelectedCourseId(data[0].id);
      fetchModules(data[0].id);
    } else {
      setSelectedCourseId("");
      resetDownstream("course");
    }
  }

  async function fetchModules(courseId: string) {
    const { data } = await supabase.from("modules").select("*").eq("course_id", courseId).order("created_at", { ascending: true });
    setModules(data || []);
    if (data && data.length > 0) {
      setSelectedModuleId(data[0].id);
      fetchTopics(data[0].id);
    } else {
      setSelectedModuleId("");
      resetDownstream("module");
    }
  }

  async function fetchTopics(moduleId: string) {
    const { data } = await supabase.from("topics").select("*").eq("module_id", moduleId).order("created_at", { ascending: true });
    setTopics(data || []);
    if (data && data.length > 0) {
      setSelectedTopicId(data[0].id);
      fetchResources(data[0].id);
    } else {
      setSelectedTopicId("");
      resetDownstream("topic");
    }
  }

  async function fetchResources(topicId: string) {
    const { data } = await supabase.from("resources").select("*").eq("topic_id", topicId).order("created_at", { ascending: true });
    setResources(data || []);
  }

  // Helper to clear downstream dropdowns when a parent is empty
  function resetDownstream(level: string) {
    if (level === "semester") { setCourses([]); setModules([]); setTopics([]); setResources([]); setSelectedCourseId(""); setSelectedModuleId(""); setSelectedTopicId(""); }
    if (level === "course") { setModules([]); setTopics([]); setResources([]); setSelectedModuleId(""); setSelectedTopicId(""); }
    if (level === "module") { setTopics([]); setResources([]); setSelectedTopicId(""); }
    if (level === "topic") { setResources([]); }
  }

  // --- Add Resource Handler ---
  async function handleAddResource(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !selectedTopicId) return alert("Select a topic first");

    const trimmedTitle = resourceTitle.trim();
    const trimmedUrl = resourceUrl.trim();
    if (!trimmedTitle) return alert("Resource title is required.");
    if (!trimmedUrl) return alert("Resource URL is required.");

    try {
      new URL(trimmedUrl);
    } catch {
      return alert("Please enter a valid URL.");
    }

    const { error } = await supabase.from("resources").insert({
      user_id: userId,
      topic_id: selectedTopicId,
      title: trimmedTitle,
      url: trimmedUrl,
      type: resourceType
    });

    if (!error) {
      setResourceTitle("");
      setResourceUrl("");
      fetchResources(selectedTopicId);
    } else {
      alert(error.message);
    }
  }

  if (!userId) return <div className="p-8 text-slate-100">Please log in.</div>;

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-300">
      <AppSidebar />
      <div className="flex-1 p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-100">Add Study Resources</h1>
          <p className="text-slate-400">Link YouTube videos, playlists, and websites to your topics.</p>
        </header>

        {/* Target Selection Cascade */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-8 bg-slate-900 p-4 rounded-lg border border-slate-800">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Year</label>
            <select value={selectedYearId} onChange={(e) => { setSelectedYearId(e.target.value); fetchSemesters(e.target.value); }} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-sm outline-none">
              {years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Semester</label>
            <select value={selectedSemesterId} onChange={(e) => { setSelectedSemesterId(e.target.value); fetchCourses(e.target.value); }} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-sm outline-none">
              {semesters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Course</label>
            <select value={selectedCourseId} onChange={(e) => { setSelectedCourseId(e.target.value); fetchModules(e.target.value); }} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-sm outline-none">
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Module</label>
            <select value={selectedModuleId} onChange={(e) => { setSelectedModuleId(e.target.value); fetchTopics(e.target.value); }} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-sm outline-none">
              {modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-blue-400 font-medium mb-1">Topic</label>
            <select value={selectedTopicId} onChange={(e) => { setSelectedTopicId(e.target.value); fetchResources(e.target.value); }} className="w-full bg-blue-900/20 border border-blue-900/50 text-blue-300 rounded px-2 py-1 text-sm outline-none font-medium">
              {topics.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ADD RESOURCE FORM */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg h-fit">
            <h2 className="text-xl font-semibold text-slate-200 mb-4">Link Resource</h2>
            <form onSubmit={handleAddResource} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Resource Type</label>
                <select value={resourceType} onChange={(e) => setResourceType(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 outline-none">
                  <option value="youtube_video">YouTube Video</option>
                  <option value="youtube_playlist">YouTube Playlist</option>
                  <option value="website">Website / Article</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Title</label>
                <input type="text" value={resourceTitle} onChange={(e) => setResourceTitle(e.target.value)} placeholder="e.g. FreeCodeCamp C Programming Course" className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 outline-none" required />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">URL (Link)</label>
                <input type="url" value={resourceUrl} onChange={(e) => setResourceUrl(e.target.value)} placeholder="https://..." className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 outline-none" required />
              </div>
              <button type="submit" disabled={!selectedTopicId} className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors disabled:opacity-50">
                Save Resource
              </button>
            </form>
          </div>

          {/* RESOURCES LIST */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 p-6 rounded-lg">
            <h2 className="text-xl font-semibold text-slate-200 mb-6">Resources in Topic</h2>
            
            {resources.length === 0 ? (
              <p className="text-slate-500 italic">No resources linked to this topic yet.</p>
            ) : (
              <div className="space-y-3">
                {resources.map(resource => (
                  <div key={resource.id} className="bg-slate-950 border border-slate-800 p-4 rounded flex justify-between items-center hover:border-slate-700 transition-colors">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                          resource.type === 'youtube_video' ? 'bg-red-900/30 text-red-400' :
                          resource.type === 'youtube_playlist' ? 'bg-purple-900/30 text-purple-400' :
                          'bg-blue-900/30 text-blue-400'
                        }`}>
                          {resource.type.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-slate-500">Status: {resource.status.replace('_', ' ')}</span>
                      </div>
                      <h3 className="font-medium text-slate-200">{resource.title}</h3>
                    </div>
                    <a 
                      href={resource.url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm px-4 py-2 rounded transition-colors flex-shrink-0"
                    >
                      Open Resource
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}