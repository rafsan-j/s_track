"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import Link from "next/link";
import { AppSidebar } from "@/components/AppSidebar";

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
    let queue = [];
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
        <header className="mb-8 flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-bold text-slate-100">Dashboard</h2>
            <p className="text-slate-400 mt-2">Welcome back. Here is your current academic overview.</p>
          </div>
          
          {resumeQueue.length > 0 && (
            <a 
              href={resumeQueue[0].resourceUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="hidden md:inline-flex bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md font-medium transition-colors shadow-lg shadow-blue-900/20"
            >
              Resume: {resumeQueue[0].courseName}
            </a>
          )}
        </header>

        {!currentSemester ? (
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-lg text-center">
            <h3 className="text-lg font-medium text-slate-200 mb-2">No Setup Found</h3>
            <p className="text-slate-400 mb-4">You need to create an Academic Year and Semester first.</p>
            <Link href="/manage" className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded transition-colors">Go to Settings</Link>
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* Progress Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Overall Semester Progress Card */}
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg flex flex-col justify-center">
                <h3 className="text-lg font-semibold text-slate-200 mb-2">Overall Progress</h3>
                <p className="text-sm text-slate-400 mb-4">{currentSemester.name}</p>
                <div className="flex items-end gap-2 mb-2">
                  <span className="text-4xl font-bold text-blue-400">{semesterProgress}%</span>
                  <span className="text-sm text-slate-500 mb-1">completed</span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-2 mt-2">
                  <div className="bg-blue-600 h-2 rounded-full transition-all duration-1000" style={{ width: `${semesterProgress}%` }}></div>
                </div>
              </div>

              {/* Individual Course Progress Bars */}
              <div className="lg:col-span-2 bg-slate-900 border border-slate-800 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-slate-200 mb-6">Course Breakdown</h3>
                <div className="space-y-5">
                  {courseProgresses.map(course => (
                    <div key={course.id}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-slate-300">{course.name}</span>
                        <span className="text-slate-400">{course.progress}%</span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-1.5">
                        <div className="bg-slate-400 h-1.5 rounded-full transition-all duration-1000" style={{ width: `${course.progress}%` }}></div>
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
              <h3 className="text-xl font-semibold text-slate-200 border-b border-slate-800 pb-2 mb-6">Continue Where You Left Off</h3>
              {resumeQueue.length === 0 ? (
                <p className="text-slate-500 italic">No resources tracked yet. Add some resources and update their status in the Study Workspace.</p>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {resumeQueue.map((item, index) => (
                    <div key={item.courseId} className={`bg-slate-900 border ${index === 0 ? 'border-blue-900/50 shadow-md shadow-blue-900/10' : 'border-slate-800'} p-6 rounded-lg flex flex-col justify-between transition-all hover:border-slate-700`}>
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="text-lg font-bold text-slate-200">{item.courseName}</h4>
                          {index === 0 && <span className="text-[10px] uppercase font-bold bg-blue-900/30 text-blue-400 px-2 py-1 rounded">Latest</span>}
                        </div>
                        <p className="text-sm text-slate-400 font-medium mb-1">{item.topicTitle}</p>
                        <p className="text-sm text-slate-300 line-clamp-1">{item.resourceTitle}</p>
                      </div>
                      
                      <div className="mt-6 flex gap-3">
                        <a 
                          href={item.resourceUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded font-medium transition-colors text-center flex-1"
                        >
                          Open Resource
                        </a>
                        <Link 
                          href="/study" 
                          className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm px-4 py-2 rounded font-medium transition-colors text-center"
                        >
                          Workspace
                        </Link>
                      </div>
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