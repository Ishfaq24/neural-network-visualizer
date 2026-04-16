import React, { useEffect, useMemo, useState } from 'react'
import { appStore, useAppStore } from '../state/store.js'

export default function UIControlPanel() {
  const [activation, setActivation] = useState('relu')
  const [dropout, setDropout] = useState(0)
  const [newLayerSize, setNewLayerSize] = useState(4)
  const [presetName, setPresetName] = useState('medium')
  const [learningRate, setLearningRate] = useState(0.03)
  const [trainSteps, setTrainSteps] = useState(1)
  const [targetText, setTargetText] = useState('1,0')
  const scene = useAppStore((s) => s.scene)
  const run = useAppStore((s) => s.run)
  const ui = useAppStore((s) => s.ui)

  const outputSize = scene.layerSizes.length ? scene.layerSizes[scene.layerSizes.length - 1] : 2
  const defaultTarget = useMemo(() => {
    const values = new Array(outputSize).fill(0)
    values[0] = 1
    return values.join(', ')
  }, [outputSize])

  useEffect(() => {
    setTargetText(defaultTarget)
  }, [defaultTarget])

  const presets = {
    tiny: { label: 'Tiny', layers: [2, 3, 1], description: 'Minimal network for quick demos.' },
    medium: { label: 'Medium', layers: [3, 6, 4, 2], description: 'Balanced depth for clear activations.' },
    deep: { label: 'Deep', layers: [3, 8, 8, 4, 2], description: 'More layers for richer propagation.' }
  }

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

  function handleApplyPreset(name) {
    const actions = appStore.getSceneActions()
    if (!actions) return
    const preset = presets[name]
    if (!preset) return
    setPresetName(name)
    actions.applyPreset(preset)
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

  async function handleTrainBackprop() {
    try {
      const actions = appStore.getSceneActions()
      if (!actions) return
      const rawTarget = targetText
        .split(',')
        .map((value) => Number(value.trim()))
      const target = new Array(outputSize).fill(0).map((_, index) => {
        const value = rawTarget[index]
        return Number.isFinite(value) ? value : 0
      })
      await actions.trainBackprop({
        activation,
        dropout: dropout / 100,
        learningRate,
        target,
        steps: Math.max(1, Math.min(50, Number(trainSteps) || 1))
      })
    } catch (err) {
      console.error('Train backprop failed', err)
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

      <div className="panel-section panel-section-soft">
        <div className="section-label">Presets</div>
        <div className="preset-grid">
          {Object.entries(presets).map(([name, preset]) => (
            <button
              key={name}
              onClick={() => handleApplyPreset(name)}
              className={`preset-card ${presetName === name ? 'preset-card-active' : ''}`}
            >
              <span>{preset.label}</span>
              <strong>{preset.layers.join(' → ')}</strong>
              <small>{preset.description}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="panel-section panel-section-soft">
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

      <div className="panel-section panel-section-soft">
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

      <div className="panel-section panel-section-soft">
        <div className="section-label">Backpropagation</div>

        <div className="input-stack">
          <div className="field-row">
            <label className="field-label">Target Output</label>
            <span className="field-value">size {outputSize}</span>
          </div>
          <input
            type="text"
            value={targetText}
            onChange={(e) => setTargetText(e.target.value)}
            className="w-full panel-input"
            placeholder={defaultTarget}
          />
          <div className="field-hint">Comma-separated values. Example: 1, 0, 0</div>
        </div>

        <div className="training-grid">
          <div className="input-stack">
            <label className="field-label">Learning Rate</label>
            <input
              type="number"
              min="0.001"
              step="0.001"
              value={learningRate}
              onChange={(e) => setLearningRate(Number(e.target.value))}
              className="w-full panel-input"
            />
          </div>
          <div className="input-stack">
            <label className="field-label">Steps</label>
            <input
              type="number"
              min="1"
              max="50"
              value={trainSteps}
              onChange={(e) => setTrainSteps(Number(e.target.value))}
              className="w-full panel-input"
            />
          </div>
        </div>

        <button onClick={handleTrainBackprop} className="panel-btn panel-btn-primary panel-btn-full" disabled={ui.status === 'training'}>
          {ui.status === 'training' ? 'Training…' : 'Train Backprop'}
        </button>
      </div>

      {run.lastActivations && (
        <div className="mt-3 text-xs panel-result">
          <div className="font-medium">Last run</div>
          <div>Input: <pre className="whitespace-pre-wrap">{JSON.stringify(run.lastInput)}</pre></div>
          {run.lastTarget && <div>Target: <pre className="whitespace-pre-wrap">{JSON.stringify(run.lastTarget)}</pre></div>}
          {run.lastLoss !== null && run.lastLoss !== undefined && <div>Loss: <pre className="whitespace-pre-wrap">{String(run.lastLoss)}</pre></div>}
          <div>Activations: <pre className="whitespace-pre-wrap">{JSON.stringify(run.lastActivations)}</pre></div>
        </div>
      )}

      {run.error && <div className="text-rose-400 text-xs">Forward error: {run.error}</div>}

      <div className="text-xs text-slate-400 leading-relaxed">
        Use a preset to change the full topology instantly, or build one manually and run a forward pass. Orbit the scene with the mouse to inspect the network.
      </div>
    </div>
  )
}