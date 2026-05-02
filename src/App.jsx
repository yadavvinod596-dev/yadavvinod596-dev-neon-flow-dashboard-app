import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Layout,
  LogOut,
  Mail,
  Plus,
  Search,
  Share2,
  Trash2,
  User,
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
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';

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
    requiresLogin: false,
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
    signInWithGoogle: null,
    signInWithEmail: null,
    signUpWithEmail: null,
    signOutUser: null,
