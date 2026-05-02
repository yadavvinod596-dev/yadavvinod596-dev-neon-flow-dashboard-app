import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Layout,
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
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';

const localStorageKey = 'neon-flow-tasks';
const statuses = ['todo', 'progress', 'done'];
const appId = import.meta.env.VITE_APP_ID || 'neon-task-dashboard';

function getFirebaseConfig() {
  const rawConfig = import.meta.env.VITE_FIREBASE_CONFIG;

  if (!rawConfig) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawConfig);
    return parsed.apiKey && parsed.projectId ? parsed : null;
  } catch (error) {
    console.warn('Invalid VITE_FIREBASE_CONFIG. Falling back to local storage.', error);
    return null;
  }
}

function createLocalTaskStore() {
  const readTasks = () => {
    try {
      return JSON.parse(localStorage.getItem(localStorageKey) || '[]');
    } catch {
      return [];
    }
  };

  const writeTasks = (nextTasks) => {
    localStorage.setItem(localStorageKey, JSON.stringify(nextTasks));
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
    async addTask(task) {
      const nextTask = { ...task, id: crypto.randomUUID(), createdAt: Date.now(), userId: 'local' };
      writeTasks([nextTask, ...readTasks()]);
    },
    async updateTask(taskId, updates) {
      writeTasks(readTasks().map((task) => (task.id === taskId ? { ...task, ...updates } : task)));
    },
    async deleteTask(taskId) {
      writeTasks(readTasks().filter((task) => task.id !== taskId));
    },
  };
}

function createFirebaseTaskStore(config) {
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const tasksRef = collection(db, 'artifacts', appId, 'public', 'data', 'tasks');

  return {
    mode: 'firebase',
    subscribe(callback, onError) {
      let unsubscribeTasks = null;
      const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          await signInAnonymously(auth);
          return;
        }

        if (unsubscribeTasks) {
          unsubscribeTasks();
        }

        unsubscribeTasks = onSnapshot(
          query(tasksRef),
          (snapshot) => {
            callback(snapshot.docs.map((taskDoc) => ({ id: taskDoc.id, ...taskDoc.data() })));
          },
          onError,
        );
      });

      signInAnonymously(auth).catch(onError);

      return () => {
        unsubscribeAuth();
        if (unsubscribeTasks) {
          unsubscribeTasks();
        }
      };
    },
    async addTask(task) {
      await addDoc(tasksRef, { ...task, createdAt: Date.now(), userId: auth.currentUser?.uid || 'anonymous' });
    },
    async updateTask(taskId, updates) {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tasks', taskId), updates);
    },
    async deleteTask(taskId) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tasks', taskId));
    },
  };
}

const taskStore = getFirebaseConfig()
  ? createFirebaseTaskStore(getFirebaseConfig())
  : createLocalTaskStore();

const emptyTask = {
  title: '',
  priority: 'Medium',
  status: 'todo',
  description: '',
};

const columnConfig = {
  todo: { label: 'To Do', style: 'todo', icon: Clock },
  progress: { label: 'In Progress', style: 'progress', icon: Layout },
  done: { label: 'Done', style: 'done', icon: CheckCircle2 },
};

const priorityStyles = {
  Low: 'priority-low',
  Medium: 'priority-medium',
  High: 'priority-high',
};

export default function App() {
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
    const unsubscribe = taskStore.subscribe(
      (taskData) => {
        setTasks(taskData);
        setLoading(false);
      },
      (error) => {
        console.error('Task sync error:', error);
        setLoading(false);
        showNotification('Task sync failed. Check your Firebase settings.');
      },
    );

    return () => unsubscribe();
  }, []);

  const handleAddTask = async (event) => {
    event.preventDefault();
    if (!newTask.title.trim()) {
      return;
    }

    try {
      await taskStore.addTask({
        ...newTask,
        title: newTask.title.trim(),
        description: newTask.description.trim(),
      });
      setNewTask(emptyTask);
      setIsAddModalOpen(false);
      showNotification('Task added successfully!');
    } catch (error) {
      console.error('Error adding task:', error);
      showNotification('Could not add task.');
    }
  };

  const moveTask = async (taskId, currentStatus, direction) => {
    const currentIndex = statuses.indexOf(currentStatus);
    const newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;

    if (newIndex < 0 || newIndex >= statuses.length) {
      return;
    }

    await taskStore.updateTask(taskId, { status: statuses[newIndex] });
  };

  const deleteTask = async (taskId) => {
    try {
      await taskStore.deleteTask(taskId);
      showNotification('Task removed.');
    } catch (error) {
      console.error('Error deleting task:', error);
      showNotification('Could not remove task.');
    }
  };

  const shareDashboard = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showNotification('Dashboard link copied to clipboard!');
    } catch {
      showNotification('Copy this URL from the address bar.');
    }
  };

  const filteredTasks = useMemo(() => {
    const queryText = searchQuery.toLowerCase();

    return tasks.filter((task) => {
      const matchesSearch = (task.title || '').toLowerCase().includes(queryText);
      const matchesFilter =
        activeFilter === 'All' ||
        (activeFilter === 'To Do' && task.status === 'todo') ||
        (activeFilter === 'In Progress' && task.status === 'progress') ||
        (activeFilter === 'Done' && task.status === 'done');

      return matchesSearch && matchesFilter;
    });
  }, [tasks, searchQuery, activeFilter]);

  const stats = [
    { label: 'Total', value: tasks.length, color: 'stat-purple' },
    { label: 'To Do', value: tasks.filter((task) => task.status === 'todo').length, color: 'stat-pink' },
    {
      label: 'In Progress',
      value: tasks.filter((task) => task.status === 'progress').length,
      color: 'stat-cyan',
    },
    { label: 'Done', value: tasks.filter((task) => task.status === 'done').length, color: 'stat-green' },
  ];

  return (
    <div className="app-shell">
      <div className="background-glow glow-one" />
      <div className="background-glow glow-two" />

      {notification && (
        <div className="toast" role="status">
          <span />
          {notification}
        </div>
      )}

      <div className="dashboard">
        <header className="header">
          <div>
            <div className="brand-row">
              <div className="brand-icon">
                <Layout size={26} />
              </div>
              <h1>NEON FLOW</h1>
            </div>
            <p>
              {taskStore.mode === 'firebase'
                ? 'Real-time task synchronization across devices.'
                : 'Local task board. Add Firebase env values for multi-device sync.'}
            </p>
          </div>

          <div className="header-actions">
            <button className="secondary-button" type="button" onClick={shareDashboard}>
              <Share2 size={17} />
              Share
            </button>
            <button className="primary-button" type="button" onClick={() => setIsAddModalOpen(true)}>
              <Plus size={20} />
              New Task
            </button>
          </div>
        </header>

        <section className="stats-grid" aria-label="Task stats">
          {stats.map((stat) => (
            <article className="stat-card" key={stat.label}>
              <span>{stat.label}</span>
              <strong className={stat.color}>{stat.value}</strong>
            </article>
          ))}
        </section>

        <section className="controls" aria-label="Task controls">
          <label className="search-box">
            <Search size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search tasks by title..."
            />
          </label>
          <div className="filter-row" role="group" aria-label="Filter tasks">
            {['All', 'To Do', 'In Progress', 'Done'].map((filter) => (
              <button
                className={activeFilter === filter ? 'filter-button active' : 'filter-button'}
                key={filter}
                onClick={() => setActiveFilter(filter)}
                type="button"
              >
                {filter}
              </button>
            ))}
          </div>
        </section>

        {loading ? (
          <div className="loading-panel">Loading tasks...</div>
        ) : (
          <section className="board" aria-label="Task board">
            {Object.entries(columnConfig).map(([status, config]) => {
              const Icon = config.icon;
              const columnTasks = filteredTasks
                .filter((task) => task.status === status)
                .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

              return (
                <div className={`column ${config.style}`} key={status}>
                  <div className="column-header">
                    <div>
                      <Icon size={20} />
                      <h2>{config.label}</h2>
                    </div>
                    <span>{columnTasks.length}</span>
                  </div>

                  <div className="task-list">
                    {columnTasks.map((task) => (
                      <article className="task-card" key={task.id}>
                        <div className="task-topline">
                          <span className={`priority ${priorityStyles[task.priority] || priorityStyles.Medium}`}>
                            {task.priority}
                          </span>
                          <button
                            className="icon-button delete-button"
                            type="button"
                            onClick={() => deleteTask(task.id)}
                            aria-label={`Delete ${task.title}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        <h3>{task.title}</h3>
                        {task.description && <p>{task.description}</p>}

                        <div className="task-footer">
                          <button
                            className="icon-button"
                            disabled={status === 'todo'}
                            onClick={() => moveTask(task.id, status, 'prev')}
                            type="button"
                            aria-label={`Move ${task.title} back`}
                          >
                            <ChevronLeft size={20} />
                          </button>
                          <span>
                            {task.createdAt ? new Date(task.createdAt).toLocaleDateString() : 'Today'}
                          </span>
                          <button
                            className="icon-button"
                            disabled={status === 'done'}
                            onClick={() => moveTask(task.id, status, 'next')}
                            type="button"
                            aria-label={`Move ${task.title} forward`}
                          >
                            <ChevronRight size={20} />
                          </button>
                        </div>
                      </article>
                    ))}

                    {columnTasks.length === 0 && (
                      <div className="empty-state">
                        <AlertCircle size={38} />
                        <span>Empty</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </div>

      {isAddModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="create-task-title">
            <div className="modal-header">
              <h2 id="create-task-title">Create New Task</h2>
              <button className="icon-button" onClick={() => setIsAddModalOpen(false)} type="button">
                <X size={24} />
              </button>
            </div>

            <form className="task-form" onSubmit={handleAddTask}>
              <label>
                <span>Task Title</span>
                <input
                  autoFocus
                  required
                  type="text"
                  placeholder="Review the design system..."
                  value={newTask.title}
                  onChange={(event) => setNewTask({ ...newTask, title: event.target.value })}
                />
              </label>

              <label>
                <span>Context</span>
                <textarea
                  placeholder="Describe the objective..."
                  rows="3"
                  value={newTask.description}
                  onChange={(event) => setNewTask({ ...newTask, description: event.target.value })}
                />
              </label>

              <div className="form-grid">
                <label>
                  <span>Priority</span>
                  <select
                    value={newTask.priority}
                    onChange={(event) => setNewTask({ ...newTask, priority: event.target.value })}
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                  </select>
                </label>
                <label>
                  <span>Status</span>
                  <select
                    value={newTask.status}
                    onChange={(event) => setNewTask({ ...newTask, status: event.target.value })}
                  >
                    <option value="todo">To Do</option>
                    <option value="progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                </label>
              </div>

              <div className="form-actions">
                <button className="text-button" type="button" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </button>
                <button className="primary-button" type="submit">
                  Deploy Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
