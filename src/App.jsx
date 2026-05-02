import React from 'react';
import { LoginScreen } from './LoginScreen';
import { FirebaseConfig } from './FirebaseConfig';

const App = () => {
    return (
        <div className="App">
            <FirebaseConfig />
            <LoginScreen />
        </div>
    );
};

export default App;