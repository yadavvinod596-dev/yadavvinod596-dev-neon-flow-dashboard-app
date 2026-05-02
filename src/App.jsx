import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Auth } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { LoginScreen } from './LoginScreen';
import { TaskStore } from './TaskStore';
import './App.css';

const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT_ID.appspot.com',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);
const auth = Auth(app);

const App = () => {
  const [tasks, setTasks] = useState([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsAuthenticated(!!user);
    });
    return () => unsubscribe();
  }, []);

  const addTask = (task) => {
    // Logic to add task to the Firestore
  };

  const completeTask = (taskId) => {
    // Logic to mark task as complete
  };

  return (
    <div className="App">
      {isAuthenticated ? (
        <TaskStore tasks={tasks} onAddTask={addTask} onCompleteTask={completeTask} />
      ) : (
        <LoginScreen />
      )}
    </div>
  );
};

export default App;