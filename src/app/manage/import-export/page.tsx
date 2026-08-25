"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import Link from "next/link";

export default function ImportExportPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);

  // Data States
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  
  // Import States
  const [jsonInput, setJsonInput] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importLog, setImportLog] = useState<string[]>([]);

  // Export State
  const [isExporting, setIsExporting] = useState(false);

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
    const { data } = await supabase.from("courses").select("id, name, semesters(name, academic_years(name))").eq("status", "active");
    setCourses(data || []);
    if (data && data.length > 0) {
      setSelectedCourseId(data[0].id);
    }
  }

  // --- EXPORT LOGIC ---
  async function handleExport() {
    if (!userId) return;
    setIsExporting(true);
    
    try {
      // Fetch all user data across tables
      const [years, sems, crs, mods, tops, res, tasks, sessions] = await Promise.all([
        supabase.from("academic_years").select("*"),
        supabase.from("semesters").select("*"),
        supabase.from("courses").select("*"),
        supabase.from("modules").select("*"),
        supabase.from("topics").select("*"),
        supabase.from("resources").select("*"),
        supabase.from("tasks").select("*"),
        supabase.from("study_sessions").select("*")
      ]);

      const backupData = {
        export_date: new Date().toISOString(),
        academic_years: years.data,
        semesters: sems.data,
        courses: crs.data,
        modules: mods.data,
        topics: tops.data,
        resources: res.data,
        tasks: tasks.data,
        study_sessions: sessions.data
      };

      // Trigger file download
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `study_os_backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchorNode); // required for firefox
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      
      alert("Backup downloaded successfully!");
    } catch (error) {
      alert("Export failed. Check console.");
    }
    setIsExporting(false);
  }

  // --- IMPORT LOGIC ---
  const log = (msg: string) => setImportLog(prev => [...prev, msg]);

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !selectedCourseId) return alert("Select a course first.");
    if (!jsonInput.trim()) return alert("Paste JSON data first.");

    let parsedData;
    try {
      parsedData = JSON.parse(jsonInput);
    } catch (error) {
      return alert("Invalid JSON format. Please check for syntax errors.");
    }

    if (!parsedData.modules || !Array.isArray(parsedData.modules)) {
      return alert("JSON must contain a root 'modules' array.");
    }

    setIsImporting(true);
    setImportLog(["Starting import..."]);

    try {
      for (let mIndex = 0; mIndex < parsedData.modules.length; mIndex++) {
        const modData = parsedData.modules[mIndex];
        log(`Creating Module: ${modData.title}`);
        
        // 1. Create Module
        const { data: newMod, error: modErr } = await supabase.from("modules")
          .insert({ user_id: userId, course_id: selectedCourseId, title: modData.title, display_order: mIndex })
          .select("id").single();
          
        if (modErr || !newMod) throw new Error(`Module Error: ${modErr?.message}`);

        // 2. Create Topics inside Module
        if (modData.topics && Array.isArray(modData.topics)) {
          for (let tIndex = 0; tIndex < modData.topics.length; tIndex++) {
            const topData = modData.topics[tIndex];
            log(`  -> Creating Topic: ${topData.title}`);
            
            const { data: newTop, error: topErr } = await supabase.from("topics")
              .insert({ user_id: userId, module_id: newMod.id, title: topData.title, display_order: tIndex })
              .select("id").single();
              
            if (topErr || !newTop) throw new Error(`Topic Error: ${topErr?.message}`);

            // 3. Create Resources inside Topic
            if (topData.resources && Array.isArray(topData.resources)) {
              for (let rIndex = 0; rIndex < topData.resources.length; rIndex++) {
                const resData = topData.resources[rIndex];
                
                await supabase.from("resources").insert({
                  user_id: userId,
                  topic_id: newTop.id,
                  title: resData.title,
                  url: resData.url || "#",
                  type: resData.type || "website",
                  display_order: rIndex
                });
              }
              log(`    -> Linked ${topData.resources.length} resources.`);
            }
          }
        }
      }
      log("✅ Import completed successfully!");
      setJsonInput(""); // Clear on success
    } catch (error: any) {
      log(`❌ Import aborted due to error: ${error.message}`);
    }
    
    setIsImporting(false);
  }

  // AI Prompt Template to show the user
  const aiPrompt = `Generate a course syllabus in JSON format. It must strictly follow this structure: 
{
  "modules": [
    {
      "title": "Module Name",
      "topics": [
        {
          "title": "Topic Name",
          "resources": [
            { "title": "Resource Name", "url": "https://...", "type": "youtube_video" }
          ]
        }
      ]
    }
  ]
}
Valid types are: youtube_video, youtube_playlist, website.`;

  if (!userId) return <div className="p-8 text-slate-100">Please log in.</div>;

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-300 font-sans">
      
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col hidden md:flex">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-bold text-slate-100">Study OS</h1>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2">
          <Link href="/" className="block px-4 py-2 rounded-md hover:bg-slate-800/50 transition-colors">Dashboard</Link>
          <Link href="/study" className="block px-4 py-2 rounded-md hover:bg-slate-800/50 transition-colors">Study Workspace</Link>
          <Link href="/planner" className="block px-4 py-2 rounded-md hover:bg-slate-800/50 transition-colors">Daily Planner</Link>
          <div className="pt-4 pb-2">
            <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Manage</p>
          </div>
          <Link href="/manage" className="block px-4 py-2 rounded-md hover:bg-slate-800/50 text-sm transition-colors">Years & Semesters</Link>
          <Link href="/manage/courses" className="block px-4 py-2 rounded-md hover:bg-slate-800/50 text-sm transition-colors">Courses</Link>
          <Link href="/manage/curriculum" className="block px-4 py-2 rounded-md hover:bg-slate-800/50 text-sm transition-colors">Curriculum</Link>
          <Link href="/manage/resources" className="block px-4 py-2 rounded-md hover:bg-slate-800/50 text-sm transition-colors">Resources</Link>
          <Link href="/manage/import-export" className="block px-4 py-2 rounded-md bg-blue-900/20 text-blue-400 font-medium border border-blue-900/50 text-sm">Import / Export</Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="mb-8 flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-bold text-slate-100">Import & Export</h2>
            <p className="text-slate-400 mt-2">Bulk create curriculum via JSON or backup your database.</p>
          </div>
          <button 
            onClick={handleExport}
            disabled={isExporting}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white px-4 py-2 rounded font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isExporting ? "Exporting..." : "↓ Download Full JSON Backup"}
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* IMPORT TOOL */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg">
            <h3 className="text-xl font-semibold text-slate-200 mb-4">Bulk Import Curriculum</h3>
            
            <form onSubmit={handleImport} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Target Course</label>
                <select 
                  value={selectedCourseId} 
                  onChange={(e) => setSelectedCourseId(e.target.value)} 
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 outline-none"
                  disabled={isImporting}
                >
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.semesters?.name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Paste JSON Syllabus</label>
                <textarea 
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  placeholder='{"modules": [{"title": "Chapter 1", "topics": [...]}]}'
                  className="w-full h-64 bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-300 outline-none font-mono text-xs focus:border-blue-500 transition-colors"
                  disabled={isImporting}
                  required
                />
              </div>

              <button 
                type="submit" 
                disabled={isImporting || courses.length === 0} 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded font-bold transition-colors disabled:opacity-50"
              >
                {isImporting ? "Importing Data..." : "Run Import Sequence"}
              </button>
            </form>

            {/* Import Log */}
            {importLog.length > 0 && (
              <div className="mt-6 bg-slate-950 border border-slate-800 rounded p-4 h-40 overflow-y-auto font-mono text-xs text-slate-400 space-y-1">
                {importLog.map((logLine, idx) => (
                  <div key={idx} className={logLine.includes('❌') ? 'text-red-400' : logLine.includes('✅') ? 'text-green-400' : ''}>
                    {logLine}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI PROMPT HELPER */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg h-fit">
            <h3 className="text-xl font-semibold text-slate-200 mb-4">How to use AI Generation</h3>
            <p className="text-sm text-slate-400 mb-6">
              You can ask ChatGPT, Claude, or Gemini to generate a complete course syllabus for you. Just copy the prompt below and paste it into the AI, then paste the AI's response into the importer here.
            </p>
            
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 relative group">
              <pre className="text-xs text-blue-300 font-mono whitespace-pre-wrap">
                {aiPrompt}
              </pre>
              <button 
                onClick={() => navigator.clipboard.writeText(aiPrompt)}
                className="absolute top-2 right-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              >
                Copy Prompt
              </button>
            </div>

            <div className="mt-6 p-4 bg-blue-900/10 border border-blue-900/30 rounded-lg">
              <h4 className="text-sm font-semibold text-blue-400 mb-1">Example Request to AI:</h4>
              <p className="text-sm text-slate-300 italic">
                "Please generate a syllabus for a 'Discrete Mathematics' university course using the JSON format above. Include YouTube video links for every topic."
              </p>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}