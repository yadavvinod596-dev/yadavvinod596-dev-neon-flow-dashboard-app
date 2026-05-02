import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Layout,
  LogOut,
  Plus,
  Search,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';

const localStorageKey = 'neon-flow-tasks';
const statuses = ['todo', 'progress', 'done'];
const appId = import.meta.env.VITE_APP_ID || 'neon-task-dashboard';

function getFirebaseConfig() {
  const rawConfig = import.meta.env.VITE_FIREBASE_CONFIG;
  if (!rawConfig) return null;
  try {
    const parsed = JSON.parse(rawConfig);
    return parsed.apiKey && parsed.projectId ? parsed : null;
  } catch {
    return null;
  }
}

const firebaseConfig = getFirebaseConfig();
let firebaseApp, firebaseAuth, firebaseDb;
if (firebaseConfig) {
  firebaseApp = initializeApp(firebaseConfig);
  firebaseAuth = getAuth(firebaseApp);
  firebaseDb = getFirestore(firebaseApp);
}

function createLocalTaskStore() {
  const readTasks = () => {
    try { return JSON.parse(localStorage.getItem(localStorageKey) || '[]'); }
    catch { return []; }
  };
  const writeTasks = (next) => {
    localStorage.setItem(localStorageKey, JSON.stringify(next));
    window.dispatchEvent(new Event('neon-flow-tasks-updated'));
  };
  return {
    mode: 'local',
    subscribe(callback) {
      const sync = () => callback(readTasks());
      sync();
      window.addEventListener('neon-flow-tasks-updated', sync);
      window.addEventListener('storage', sync);
      return () => {
        window.removeEventListener('neon-flow-tasks-updated', sync);
        window.removeEventListener('storage', sync);
      };
    },
    async addTask(task, _uid) {
      const next = { ...task, id: crypto.randomUUID(), createdAt: Date.now(), userId: 'local' };
      writeTasks([next, ...readTasks()]);
    },
    async updateTask(taskId, updates) {
      writeTasks(readTasks().map((t) => (t.id === taskId ? { ...t, ...updates } : t)));
    },
    async deleteTask(taskId) {
      writeTasks(readTasks().filter((t) => t.id !== taskId));
    },
  };
}

function createFirebaseTaskStore() {
  const tasksRef = collection(firebaseDb, 'artifacts', appId, 'public', 'data', 'tasks');
  return {
    mode: 'firebase',
    subscribe(callback, onError, uid) {
      const q = uid ? query(tasksRef, where('userId', '==', uid)) : query(tasksRef);
      return onSnapshot(q,
        (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        onError,
      );
    },
    async addTask(task, uid) {
      await addDoc(tasksRef, { ...task, createdAt: Date.now(), userId: uid });
    },
    async updateTask(taskId, updates) {
      await updateDoc(doc(firebaseDb, 'artifacts', appId, 'public', 'data', 'tasks', taskId), updates);
    },
    async deleteTask(taskId) {
      await deleteDoc(doc(firebaseDb, 'artifacts', appId, 'public', 'data', 'tasks', taskId));
    },
  };
}

const taskStore = firebaseConfig ? createFirebaseTaskStore() : createLocalTaskStore();

const emptyTask = { title: '', priority: 'Medium', status: 'todo', description: '' };
const columnConfig = {
  todo:     { label: 'To Do',       style: 'todo',     icon: Clock },
  progress: { label: 'In Progress', style: 'progress', icon: Layout },
  done:     { label: 'Done',        style: 'done',     icon: CheckCircle2 },
};
const priorityStyles = { Low: 'priority-low', Medium: 'priority-medium', High: 'priority-high' };

function LoginScreen({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let cred;
      if (mode === 'login') {
        cred = await signInWithEmailAndPassword(firebaseAuth, email, password);
      } else {
        cred = await createUserWithEmailAndPassword(firebaseAuth, email, password);
      }
      onAuth(cred.user);
    } catch (err) {
      const messages = {
        'auth/user-not-found':      'No account found with this email.',
        'auth/wrong-password':      'Incorrect password.',
        'auth/email-already-in-use':'An account with this email already exists.',
        'auth/weak-password':       'Password must be at least 6 characters.',
        'auth/invalid-email':       'Please enter a valid email address.',
        'auth/invalid-credential':  'Incorrect email or password.',
      };
      setError(messages[err.code] || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <div className="background-glow glow-one" />
      <div className="background-glow glow-two" />
      <div className="login-container">
        <div className="login-card">
          <div className="brand-row" style={{ justifyContent: 'center', marginBottom: '8px' }}>
            <div className="brand-icon"><Layout size={26} /></div>
            <h1 style={{ fontSize: '2rem' }}>Producto</h1>
          </div>
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '28px', fontSize: '0.9rem' }}>
            {mode === 'login' ? 'Sign in to your workspace' : 'Create your workspace'}
          </p>
          <form onSubmit={handleSubmit} className="task-form">
            <label>
              <span>Email</span>
              <input type="email" required autoFocus placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label>
              <span>Password</span>
              <input type="password" required placeholder={mode === 'signup' ? 'Min. 6 characters' : '••••••••'} value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            {error && (
              <div className="login-error">
                <AlertCircle size={15} /> {error}
              </div>
            )}
            <button className="primary-button" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: '4px' }}>
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
          <p style={{ textAlign: 'center', marginTop: '20px', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
              style={{ background: 'none', border: 'none', color: 'var(--accent-purple)', cursor: 'pointer', fontWeight: 600, padding: 0 }}>
              {mode === 'login' ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(!!firebaseConfig);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [notification, setNotification] = useState(null);
  const [newTask, setNewTask] = useState(emptyTask);

  const showNotification = (message) => {
    setNotification(message);
    window.setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    if (!firebaseConfig) { setAuthLoading(false); return; }
    const unsub = onAuthStateChanged(firebaseAuth, (u) => { setUser(u); setAuthLoading(false); });
    return unsub;
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (firebaseConfig && !user) return;
    const unsub = taskStore.subscribe(
      (data) => { setTasks(data); setLoading(false); },
      (err) => { console.error(err); setLoading(false); showNotification('Sync failed.'); },
      user?.uid,
    );
    return () => unsub();
  }, [authLoading, user]);

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;
    try {
      await taskStore.addTask({ ...newTask, title: newTask.title.trim(), description: newTask.description.trim() }, user?.uid || 'local');
      setNewTask(emptyTask); setIsAddModalOpen(false); showNotification('Task added!');
    } catch (err) { console.error(err); showNotification('Could not add task.'); }
  };

  const moveTask = async (taskId, currentStatus, direction) => {
    const idx = statuses.indexOf(currentStatus);
    const next = direction === 'next' ? idx + 1 : idx - 1;
    if (next < 0 || next >= statuses.length) return;
    await taskStore.updateTask(taskId, { status: statuses[next] });
  };

  const deleteTask = async (taskId) => {
    try { await taskStore.deleteTask(taskId); showNotification('Task removed.'); }
    catch (err) { console.error(err); showNotification('Could not remove task.'); }
  };

  const handleSignOut = async () => { await signOut(firebaseAuth); setTasks([]); };

  const shareDashboard = async () => {
    try { await navigator.clipboard.writeText(window.location.href); showNotification('Link copied!'); }
    catch { showNotification('Copy the URL from the address bar.'); }
  };

  const filteredTasks = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return tasks.filter((t) => {
      const matchSearch = (t.title || '').toLowerCase().includes(q);
      const matchFilter = activeFilter === 'All' ||
        (activeFilter === 'To Do' && t.status === 'todo') ||
        (activeFilter === 'In Progress' && t.status === 'progress') ||
        (activeFilter === 'Done' && t.status === 'done');
      return matchSearch && matchFilter;
    });
  }, [tasks, searchQuery, activeFilter]);

  const stats = [
    { label: 'Total',       value: tasks.length,                                        color: 'stat-purple' },
    { label: 'To Do',       value: tasks.filter((t) => t.status === 'todo').length,     color: 'stat-pink'   },
    { label: 'In Progress', value: tasks.filter((t) => t.status === 'progress').length, color: 'stat-cyan'   },
    { label: 'Done',        value: tasks.filter((t) => t.status === 'done').length,     color: 'stat-green'  },
  ];

  if (authLoading) {
    return (
      <div className="app-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="background-glow glow-one" /><div className="background-glow glow-two" />
        <div style={{ color: 'var(--text-muted)' }}>Loading…</div>
      </div>
    );
  }

  if (firebaseConfig && !user) return <LoginScreen onAuth={setUser} />;

  return (
    <div className="app-shell">
      <div className="background-glow glow-one" />
      <div className="background-glow glow-two" />
      {notification && <div className="toast" role="status"><span />{notification}</div>}
      <div className="dashboard">
        <header className="header">
          <div>
            <div className="brand-row">
              <div className="brand-icon"><Layout size={26} /></div>
              <h1>Producto</h1>
            </div>
            <p>{taskStore.mode === 'firebase' ? `Signed in as ${user?.email}` : 'Local task board. Add Firebase env values for login and multi-device sync.'}</p>
          </div>
          <div className="header-actions">
            <button className="secondary-button" type="button" onClick={shareDashboard}><Share2 size={17} /> Share</button>
            {firebaseConfig && <button className="secondary-button" type="button" onClick={handleSignOut}><LogOut size={17} /> Sign Out</button>}
            <button className="primary-button" type="button" onClick={() => setIsAddModalOpen(true)}><Plus size={20} /> New Task</button>
          </div>
        </header>
        <section className="stats-grid" aria-label="Task stats">
          {stats.map((s) => (
            <article className="stat-card" key={s.label}><span>{s.label}</span><strong className={s.color}>{s.value}</strong></article>
          ))}
        </section>
        <section className="controls" aria-label="Task controls">
          <label className="search-box">
            <Search size={20} />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search tasks by title..." />
          </label>
          <div className="filter-row" role="group" aria-label="Filter tasks">
            {['All', 'To Do', 'In Progress', 'Done'].map((f) => (
              <button className={activeFilter === f ? 'filter-button active' : 'filter-button'} key={f} onClick={() => setActiveFilter(f)} type="button">{f}</button>
            ))}
          </div>
        </section>
        {loading ? <div className="loading-panel">Loading tasks…</div> : (
          <section className="board" aria-label="Task board">
            {Object.entries(columnConfig).map(([status, config]) => {
              const Icon = config.icon;
              const colTasks = filteredTasks.filter((t) => t.status === status).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
              return (
                <div className={`column ${config.style}`} key={status}>
                  <div className="column-header"><div><Icon size={20} /><h2>{config.label}</h2></div><span>{colTasks.length}</span></div>
                  <div className="task-list">
                    {colTasks.map((task) => (
                      <article cl
