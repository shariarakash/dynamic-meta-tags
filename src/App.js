import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './App.css';
import logo from './logo.svg';

function Home() {
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.js</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
    </div>
  );
}

function About() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>About Page</h1>
        <p>This is the About page content!</p>
      </header>
    </div>
  );
}

function App() {
  return (
    <Router>
      <nav>
        <Link to="/" style={{ marginRight: '10px' }}>Home</Link>
        <Link to="/single_job_description">About</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/single_job_description" element={<About />} />
      </Routes>
    </Router>
  );
}

export default App;
