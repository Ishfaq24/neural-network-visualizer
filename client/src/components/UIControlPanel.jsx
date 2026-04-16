import React, { useState } from 'react'
import { appStore, useAppStore } from '../state/store.js'

export default function UIControlPanel() {
  const [activation, setActivation] = useState('relu')
  const [dropout, setDropout] = useState(0)
  const [newLayerSize, setNewLayerSize] = useState(4)
  const scene = useAppStore((s) => s.scene)
  const run = useAppStore((s) => s.run)
  const ui = useAppStore((s) => s.ui)

  async function handleAddLayer() {
    const actions = appStore.getSceneActions()
    if (!actions) return
    actions.addLayer(Math.max(1, Math.min(12, Number(newLayerSize) || 1)))
  }

  function handleConnectFeedForward() {
    const actions = appStore.getSceneActions()
    if (!actions) return
    actions.connectFeedForward()
  }

  function handleClear() {
    const actions = appStore.getSceneActions()
    if (!actions) return
    actions.clearNetwork()
  }

  async function handleRunForward() {
    try {
      const actions = appStore.getSceneActions()
      if (!actions) return
      await actions.runForward({ activation, dropout: dropout / 100 })
    } catch (err) {
      console.error('Run forward failed', err)
    }
  }

  return (
    <div className="panel-shell space-y-4">
      <div className="panel-title-row">
        <div>
          <h2 className="panel-title">Network Console</h2>
          <p className="panel-subtitle">Build layers, connect them, and inspect activations.</p>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <span>Nodes</span>
          <strong>{scene.nodeCount}</strong>
        </div>
        <div className="metric-card">
          <span>Connections</span>
          <strong>{scene.connectionCount}</strong>
        </div>
        <div className="metric-card metric-wide">
          <span>Layers</span>
          <strong>{scene.layerSizes.length ? scene.layerSizes.join(' • ') : 'none'}</strong>
        </div>
      </div>

      <div className="panel-section">
        <div className="section-label">Architecture</div>
        <div className="input-stack">
          <label className="field-label">New Layer Size</label>
          <input
            type="number"
            min="1"
            max="12"
            value={newLayerSize}
            onChange={(e) => setNewLayerSize(Number(e.target.value))}
            className="w-full panel-input"
          />
        </div>

        <div className="button-grid">
          <button onClick={handleAddLayer} className="panel-btn panel-btn-secondary">Add Layer</button>
          <button onClick={handleConnectFeedForward} className="panel-btn panel-btn-secondary">Auto Connect</button>
          <button onClick={handleClear} className="panel-btn panel-btn-danger">Clear Scene</button>
        </div>
      </div>

      <div className="panel-section">
        <div className="section-label">Forward Pass</div>

        <div className="input-stack">
          <label className="field-label">Activation</label>
          <select value={activation} onChange={e => setActivation(e.target.value)} className="w-full panel-input">
          <option value="relu">ReLU</option>
          <option value="sigmoid">Sigmoid</option>
          <option value="tanh">Tanh</option>
          </select>
        </div>

        <div className="input-stack">
          <div className="field-row">
            <label className="field-label">Dropout</label>
            <span className="field-value">{dropout}%</span>
          </div>
          <input
            className="panel-range"
            type="range"
            min="0"
            max="80"
            value={dropout}
            onChange={e => setDropout(Number(e.target.value))}
          />
          <div className="field-hint">Applies inverted dropout during forward passes.</div>
        </div>

        <button onClick={handleRunForward} className="panel-btn panel-btn-primary panel-btn-full" disabled={ui.status === 'running'}>
          {ui.status === 'running' ? 'Running…' : 'Run Forward'}
        </button>
      </div>

      {run.lastActivations && (
        <div className="mt-3 text-xs panel-result">
          <div className="font-medium">Last run</div>
          <div>Input: <pre className="whitespace-pre-wrap">{JSON.stringify(run.lastInput)}</pre></div>
          <div>Activations: <pre className="whitespace-pre-wrap">{JSON.stringify(run.lastActivations)}</pre></div>
        </div>
      )}

      {run.error && <div className="text-rose-400 text-xs">Forward error: {run.error}</div>}

      <div className="text-xs text-slate-400 leading-relaxed">
        Use the buttons to add layers, auto-connect them, and run a forward pass. Orbit the scene with the mouse to inspect the network.
      </div>
    </div>
  )
}