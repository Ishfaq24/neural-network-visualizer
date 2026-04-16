import React from 'react'
import CameraFeed from './components/CameraFeed'
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
          <p className="eyebrow">Realtime Gesture + NN Sandbox</p>
          <h1>Air Neural Network Visualizer</h1>
          <p>
            Sketch layers in 3D space, link neurons with hand gestures, then run forward propagation to watch activations.
          </p>
        </header>

        <CameraFeed />
        <UIControlPanel />
        <DebugOverlay />

        <div className="pane-footer">
          Built with MediaPipe Hands, Three.js, TensorFlow.js
        </div>
      </aside>
    </div>
  )
}