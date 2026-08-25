"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import Link from "next/link";

export default function PlannerPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);

  // Data
  const [courses, setCourses] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [queue, setQueue] = useState<any[]>([]);

  // Queue Form
  const [qCourseId, setQCourseId] = useState("");
  const [qTopicId, setQTopicId] = useState("");

  // Add Task Form
  const [taskTitle, setTaskTitle] = useState("");
  const [taskCourseId, setTaskCourseId] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskPriority, setTaskPriority] = useState("medium");

  // Edit Task State
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCourseId, setEditCourseId] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editPriority, setEditPriority] = useState("medium");

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        fetchCourses();
        fetchTasks(user.id);
        fetchQueue(user.id);
      }
    }
    init();
  }, []);

  // --- Fetching ---
  async function fetchCourses() {
    const { data } = await supabase.from("courses").select("*").eq("status", "active").order("name");
    setCourses(data || []);
    if (data && data.length > 0) {
      setQCourseId(data[0].id);
      fetchTopics(data[0].id);
    }
  }

  async function fetchTopics(courseId: string) {
    const { data } = await supabase.from("topics").select("*, modules!inner(course_id)").eq("modules.course_id", courseId).order("title");
    setTopics(data || []);
    if (data && data.length > 0) setQTopicId(data[0].id);
  }

  async function fetchTasks(uid: string) {
    const { data } = await supabase.from("tasks").select("*, courses(name)").eq("user_id", uid).order("due_date", { ascending: true });
    setTasks(data || []);
  }

  async function fetchQueue(uid: string) {
    const { data } = await supabase.from("study_queue").select("*, courses(name), topics(title)").eq("user_id", uid).order("display_order", { ascending: true });
    setQueue(data || []);
  }

  // --- Queue Actions ---
  async function handleAddQueue(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !qCourseId || !qTopicId) return;
    const newOrder = queue.length > 0 ? Math.max(...queue.map(q => q.display_order)) + 1 : 0;
    
    await supabase.from("study_queue").insert({
      user_id: userId, course_id: qCourseId, topic_id: qTopicId, display_order: newOrder
    });
    fetchQueue(userId);
  }

  async function handleRemoveQueue(id: string) {
    await supabase.from("study_queue").delete().eq("id", id);
    if(userId) fetchQueue(userId);
  }

  async function handleMoveQueue(index: number, direction: 'up' | 'down') {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === queue.length - 1) return;

    const newQueue = [...queue];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    
    const tempOrder = newQueue[index].display_order;
    newQueue[index].display_order = newQueue[swapIndex].display_order;
    newQueue[swapIndex].display_order = tempOrder;

    setQueue(newQueue.sort((a, b) => a.display_order - b.display_order));

    await supabase.from("study_queue").update({ display_order: newQueue[index].display_order }).eq("id", newQueue[index].id);
    await supabase.from("study_queue").update({ display_order: newQueue[swapIndex].display_order }).eq("id", newQueue[swapIndex].id);
  }

  // --- Task Actions ---
  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !taskTitle) return;

    await supabase.from("tasks").insert({
      user_id: userId,
      title: taskTitle,
      course_id: taskCourseId || null,
      due_date: taskDueDate || null,
      priority: taskPriority
    });

    setTaskTitle("");
    setTaskDueDate("");
    fetchTasks(userId);
  }

  async function handleUpdateTaskStatus(id: string, newStatus: string) {
    await supabase.from("tasks").update({ status: newStatus }).eq("id", id);
    if(userId) fetchTasks(userId);
  }

  async function handleDeleteTask(id: string) {
    if (confirm("Are you sure you want to delete this task?")) {
      await supabase.from("tasks").delete().eq("id", id);
      if(userId) fetchTasks(userId);
    }
  }

  // --- Edit Task Actions ---
  function startEditing(task: any) {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditCourseId(task.course_id || "");
    setEditPriority(task.priority);
    setEditDueDate(task.due_date ? task.due_date.split('T')[0] : ""); // Format for date input
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !editingTaskId) return;

    await supabase.from("tasks").update({
      title: editTitle,
      course_id: editCourseId || null,
      priority: editPriority,
      due_date: editDueDate || null
    }).eq("id", editingTaskId);

    setEditingTaskId(null);
    fetchTasks(userId);
  }

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
          <Link href="/planner" className="block px-4 py-2 rounded-md bg-blue-900/20 text-blue-400 font-medium border border-blue-900/50">Daily Planner</Link>
          <Link href="/sessions" className="block px-4 py-2 rounded-md hover:bg-slate-800/50 transition-colors">Study Timer</Link>
          <div className="pt-4 pb-2">
            <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Manage</p>
          </div>
          <Link href="/manage" className="block px-4 py-2 rounded-md hover:bg-slate-800/50 text-sm transition-colors">Years & Semesters</Link>
          <Link href="/manage/courses" className="block px-4 py-2 rounded-md hover:bg-slate-800/50 text-sm transition-colors">Courses</Link>
          <Link href="/manage/curriculum" className="block px-4 py-2 rounded-md hover:bg-slate-800/50 text-sm transition-colors">Curriculum</Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="mb-8">
          <h2 className="text-3xl font-bold text-slate-100">Daily Planner</h2>
          <p className="text-slate-400 mt-2">Manage your study queue and upcoming tasks.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* LEFT: Study Queue (Unchanged) */}
          <div>
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg mb-6">
              <h3 className="text-lg font-semibold text-slate-200 mb-4">Add to Study Queue</h3>
              <form onSubmit={handleAddQueue} className="space-y-3">
                <select value={qCourseId} onChange={(e) => { setQCourseId(e.target.value); fetchTopics(e.target.value); }} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm outline-none">
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={qTopicId} onChange={(e) => setQTopicId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm outline-none">
                  {topics.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm transition-colors">Add to Today's Queue</button>
              </form>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg">
              <h3 className="text-xl font-semibold text-slate-200 mb-4">Today's Queue</h3>
              {queue.length === 0 ? (
                <p className="text-slate-500 italic">Your queue is empty.</p>
              ) : (
                <div className="space-y-2">
                  {queue.map((item, index) => (
                    <div key={item.id} className="bg-slate-950 border border-slate-800 p-3 rounded flex justify-between items-center group">
                      <div className="flex-1">
                        <p className="text-xs text-blue-400 font-bold mb-0.5">{item.courses?.name}</p>
                        <p className="text-sm text-slate-200">{item.topics?.title}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col gap-1">
                          <button onClick={() => handleMoveQueue(index, 'up')} disabled={index === 0} className="text-slate-500 hover:text-white disabled:opacity-30">▲</button>
                          <button onClick={() => handleMoveQueue(index, 'down')} disabled={index === queue.length - 1} className="text-slate-500 hover:text-white disabled:opacity-30">▼</button>
                        </div>
                        <button onClick={() => handleRemoveQueue(item.id)} className="ml-2 text-red-500 hover:text-red-400 text-xl">×</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Tasks */}
          <div>
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg mb-6">
              <h3 className="text-lg font-semibold text-slate-200 mb-4">Add Task</h3>
              <form onSubmit={handleAddTask} className="space-y-3">
                <input type="text" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Task title (e.g., Submit Assignment)" className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm outline-none" required />
                <div className="grid grid-cols-2 gap-3">
                  <select value={taskCourseId} onChange={(e) => setTaskCourseId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm outline-none">
                    <option value="">No specific course</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <select value={taskPriority} onChange={(e) => setTaskPriority(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm outline-none">
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                </div>
                <input type="date" value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm outline-none text-slate-400" />
                <button type="submit" className="w-full bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded text-sm transition-colors border border-slate-700">Create Task</button>
              </form>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg">
              <h3 className="text-xl font-semibold text-slate-200 mb-4">Action Items</h3>
              {tasks.length === 0 ? (
                <p className="text-slate-500 italic">No pending tasks.</p>
              ) : (
                <div className="space-y-3">
                  {tasks.map(task => (
                    <div key={task.id} className={`p-4 rounded border transition-colors ${task.status === 'completed' ? 'bg-slate-950/50 border-slate-800/50 opacity-60' : 'bg-slate-950 border-slate-800'}`}>
                      
                      {/* INLINE EDIT FORM */}
                      {editingTaskId === task.id ? (
                        <form onSubmit={handleSaveEdit} className="space-y-3">
                          <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm outline-none text-white" required />
                          <div className="grid grid-cols-2 gap-2">
                            <select value={editCourseId} onChange={(e) => setEditCourseId(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm outline-none">
                              <option value="">No course</option>
                              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <select value={editPriority} onChange={(e) => setEditPriority(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm outline-none">
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                            </select>
                          </div>
                          <input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm outline-none text-slate-400" />
                          <div className="flex gap-2">
                            <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-1 rounded text-sm transition-colors">Save</button>
                            <button type="button" onClick={() => setEditingTaskId(null)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-1 rounded text-sm transition-colors">Cancel</button>
                          </div>
                        </form>
                      ) : (
                        
                        /* NORMAL TASK DISPLAY */
                        <>
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h4 className={`font-medium ${task.status === 'completed' ? 'line-through text-slate-500' : 'text-slate-200'}`}>{task.title}</h4>
                              <div className="flex gap-2 mt-1">
                                {task.courses && <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-900 px-2 py-0.5 rounded">{task.courses.name}</span>}
                                {task.priority === 'high' && <span className="text-[10px] uppercase font-bold text-red-400 bg-red-900/20 px-2 py-0.5 rounded">High</span>}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <select 
                                value={task.status} 
                                onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value)}
                                className={`text-xs rounded px-2 py-1 outline-none border ${
                                  task.status === 'completed' ? 'bg-green-900/20 border-green-900 text-green-500' :
                                  task.status === 'in_progress' ? 'bg-blue-900/20 border-blue-900 text-blue-400' :
                                  'bg-slate-900 border-slate-700 text-slate-400'
                                }`}
                              >
                                <option value="todo">To Do</option>
                                <option value="in_progress">In Progress</option>
                                <option value="completed">Completed</option>
                              </select>
                              
                              {/* Edit & Delete Actions */}
                              <div className="flex gap-2 text-xs">
                                <button onClick={() => startEditing(task)} className="text-blue-400 hover:text-blue-300">Edit</button>
                                <button onClick={() => handleDeleteTask(task.id)} className="text-red-400 hover:text-red-300">Delete</button>
                              </div>
                            </div>
                          </div>
                          {task.due_date && (
                            <p className="text-xs text-slate-500 mt-2">Due: {new Date(task.due_date).toLocaleDateString()}</p>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
        </div>
      </main>
    </div>
  );
}