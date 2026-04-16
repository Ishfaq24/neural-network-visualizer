import React from 'react'
import ThreeScene from './three/ThreeScene'
import UIControlPanel from './components/UIControlPanel'
import DebugOverlay from './components/DebugOverlay'
import './App.css'

export default function App() {
  return (
    <div className="app-shell">
      <div className="ambient-orb orb-a" />
      <div className="ambient-orb orb-b" />

      <div className="scene-pane">
        <ThreeScene />
      </div>

      <aside className="control-pane">
        <header className="pane-header">
          <p className="eyebrow">Neural Network Visualizer</p>
          <h1>Simple Neural Network Visualizer</h1>
          <p>
            Build layers, connect them automatically, and run forward propagation to inspect activations.
          </p>
        </header>

        <UIControlPanel />
        <DebugOverlay />

        <div className="pane-footer">
          Built with Three.js and TensorFlow.js
        </div>
      </aside>
    </div>
  )
}