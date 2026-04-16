import * as THREE from 'three'
import { Raycaster } from 'three'
import { forward as nnForward, createNetwork, disposeNetwork, trainStep } from '../nn-engine/NNEngine'

// Manages nodes and connections in a Three.js scene.
// Responsibilities:
// - createNeuron(pos), createLayer(positions), createConnection(aId,bId)
// - handle selection, drag, delete, signal animation
// - update(dt, gestureState) // called each frame

let idCounter = 1

export default class NeuralScene {
  constructor(scene, camera, domElement) {
    this.scene = scene
    this.camera = camera
    this.domElement = domElement
    this.raycaster = new Raycaster()

    this.nodes = new Map() // id -> {mesh, id, layerId|null}
    this.layers = [] // [{id, nodeIds, x}]
    this.connections = [] // [{aId,bId,line,key}]
    this.selected = null
    this.linkSourceId = null
    this.hover = null
    this.lastPointer = new THREE.Vector2()
    this.pinchActive = false
    this.lastDeleteAt = 0

    this.signalQueue = [] // animations for forward pass
    this.animationTimers = []

    // GPU-friendly materials
    this.nodeMaterial = new THREE.MeshStandardMaterial({ color: 0x2563eb, metalness: 0.12, roughness: 0.42 })
    this.nodeSelectedMat = new THREE.MeshStandardMaterial({ color: 0xd97706, emissive: 0x331a00 })
    this.nodeHighlightMat = new THREE.MeshStandardMaterial({ color: 0x14b8a6, emissive: 0x093f3a })
    this.nodePulseMat = new THREE.MeshStandardMaterial({ color: 0xfb7185, emissive: 0x4a1020 })

    // simple NN for simulation
    this.network = createNetwork([3, 4, 2], 'relu', 0.0)

    this.tmpVec = new THREE.Vector3()
  }

  _nextId() { return idCounter++ }

  _nextLayerId() { return `L${this.layers.length + 1}` }

  _edgeKey(aId, bId) {
    return `${aId}->${bId}`
  }

  _hasConnection(aId, bId) {
    return this.connections.some((c) => c.aId === aId && c.bId === bId)
  }

  _ensureNetwork(options = {}) {
    const sizes = this.getLayerSizes()
    if (sizes.length < 2) {
      throw new Error('Create at least two layers before training')
    }

    const activation = options.activation || this.network.activation || 'relu'
    const dropout = typeof options.dropout === 'number' ? options.dropout : (this.network.dropout || 0)
    const needsRebuild = !this.network
      || !Array.isArray(this.network.sizes)
      || this.network.sizes.length !== sizes.length
      || this.network.sizes.some((size, index) => size !== sizes[index])
      || this.network.activation !== activation
      || this.network.dropout !== dropout

    if (needsRebuild) {
      if (this.network) {
        try { disposeNetwork(this.network) } catch (err) {}
      }
      this.network = createNetwork(sizes, activation, dropout)
    } else {
      this.network.activation = activation
      this.network.dropout = dropout
    }

    return this.network
  }

  _refreshNodeVisuals() {
    for (const [id, node] of this.nodes) {
      if (id === this.selected) node.mesh.material = this.nodeSelectedMat
      else if (id === this.hover) node.mesh.material = this.nodeHighlightMat
      else node.mesh.material = this.nodeMaterial
    }
  }

  createNeuron(pos = { x: 0, y: 0, z: 0 }, layerId = null) {
    const geometry = new THREE.SphereGeometry(0.18, 24, 18)
    const mesh = new THREE.Mesh(geometry, this.nodeMaterial)
    mesh.position.set(pos.x, pos.y, pos.z)
    mesh.userData.id = this._nextId()
    mesh.userData.layerId = layerId
    this.scene.add(mesh)
    this.nodes.set(mesh.userData.id, { id: mesh.userData.id, mesh, layerId })
    return mesh.userData.id
  }

  createLayerByCount(count = 3, options = {}) {
    const layerId = this._nextLayerId()
    const x = typeof options.x === 'number' ? options.x : (this.layers.length - 1.5) * 1.8
    const centerY = typeof options.centerY === 'number' ? options.centerY : 0
    const spacing = typeof options.spacing === 'number' ? options.spacing : 0.85
    const z = typeof options.z === 'number' ? options.z : 0
    const ids = []

    for (let i = 0; i < count; i++) {
      const yOffset = ((count - 1) * spacing) / 2
      const y = centerY + (i * spacing - yOffset)
      ids.push(this.createNeuron({ x, y, z }, layerId))
    }

    this.layers.push({ id: layerId, nodeIds: ids, x })
    this._refreshNodeVisuals()
    return layerId
  }

  createLayer(positions = []) {
    const layerId = this._nextLayerId()
    const ids = positions.map((p) => this.createNeuron(p, layerId))
    this.layers.push({ id: layerId, nodeIds: ids, x: positions[0]?.x || 0 })
    this._refreshNodeVisuals()
    return ids
  }

  connectLayers(fromLayerId, toLayerId) {
    const from = this.layers.find((l) => l.id === fromLayerId)
    const to = this.layers.find((l) => l.id === toLayerId)
    if (!from || !to) return 0

    let created = 0
    from.nodeIds.forEach((aId) => {
      to.nodeIds.forEach((bId) => {
        if (this.createConnection(aId, bId)) created += 1
      })
    })
    return created
  }

  connectFeedForward() {
    let created = 0
    for (let i = 0; i < this.layers.length - 1; i++) {
      created += this.connectLayers(this.layers[i].id, this.layers[i + 1].id)
    }
    return created
  }

  createConnection(aId, bId) {
    const a = this.nodes.get(aId)
    const b = this.nodes.get(bId)
    if (!a || !b || this._hasConnection(aId, bId)) return null
    const points = [a.mesh.position.clone(), b.mesh.position.clone()]
    const lineGeom = new THREE.BufferGeometry().setFromPoints(points)
    const mat = new THREE.LineBasicMaterial({ color: 0xcbd5e1, transparent: true, opacity: 0.48 })
    const line = new THREE.Line(lineGeom, mat)
    this.scene.add(line)
    this.connections.push({ aId, bId, line, key: this._edgeKey(aId, bId), baseOpacity: 0.48, baseColor: 0xcbd5e1 })
    return true
  }

  removeNode(id) {
    const node = this.nodes.get(id)
    if (!node) return false
    // remove connections referencing it
    const toRemove = this.connections.filter(c => c.aId === id || c.bId === id)
    toRemove.forEach(c => {
      this.scene.remove(c.line)
    })
    this.connections = this.connections.filter(c => c.aId !== id && c.bId !== id)
    this.scene.remove(node.mesh)
    this.layers = this.layers
      .map((layer) => ({ ...layer, nodeIds: layer.nodeIds.filter((nodeId) => nodeId !== id) }))
      .filter((layer) => layer.nodeIds.length > 0)
    this.nodes.delete(id)
    if (this.selected === id) this.selected = null
    if (this.hover === id) this.hover = null
    this._refreshNodeVisuals()
    return true
  }

  clear() {
    this.selected = null
    this.linkSourceId = null
    this.hover = null
    this.pinchActive = false
    this.nodes.forEach((n) => {
      n.mesh.geometry.dispose()
      this.scene.remove(n.mesh)
    })
    this.connections.forEach((c) => {
      c.line.geometry.dispose()
      c.line.material.dispose()
      this.scene.remove(c.line)
    })
    this.nodes.clear()
    this.connections = []
    this.layers = []
    this.animationTimers.forEach((timer) => clearTimeout(timer))
    this.animationTimers = []
  }

  getLayerSizes() {
    return this.layers.map((l) => l.nodeIds.length)
  }

  getStats() {
    return {
      nodeCount: this.nodes.size,
      connectionCount: this.connections.length,
      layerSizes: this.getLayerSizes()
    }
  }

  // Map normalized screen landmarks to world coords near camera plane
  screenToWorldPoint(screenNorm, depth = 0.5) {
    // screenNorm: {x,y} with x,y in [0,1] from left-top (mediapipe coords)
    // Convert to NDC
    const x = (screenNorm.x - 0.5) * 2
    const y = -(screenNorm.y - 0.5) * 2
    const vec = new THREE.Vector3(x, y, depth).unproject(this.camera)
    return vec
  }

  // update called every frame
  update(dt, gestureState = {}) {
    // dt seconds, gestureState: {landmarks, gesture, confidence}
    const { landmarks = null, gesture = null } = gestureState
    // highlight selected/hover based on latest gestures
    if (landmarks && landmarks[8]) {
      // index fingertip normalized coords
      const idxTip = landmarks[8]
      const world = this.screenToWorldPoint(idxTip, 0.5)
      // determine nearest node within threshold
      let nearest = null
      let minD = 0.5
      for (const [id, node] of this.nodes) {
        const d = node.mesh.position.distanceTo(world)
        if (d < minD) {
          minD = d
          nearest = id
        }
      }
      if (nearest !== this.hover) {
        this.hover = nearest
        this._refreshNodeVisuals()
      }

      // pinch: arm a connection source or create/select a neuron
      if (gesture === 'pinch') {
        if (!this.pinchActive) {
          this.pinchActive = true
          if (this.hover) {
            if (this.linkSourceId && this.linkSourceId !== this.hover) {
              this.createConnection(this.linkSourceId, this.hover)
              this.selected = this.hover
              this.linkSourceId = null
            } else {
              this.selected = this.hover
              this.linkSourceId = this.hover
            }
          } else {
            const newId = this.createNeuron({ x: world.x, y: world.y, z: world.z })
            const nodeEntry = this.nodes.get(newId)
            nodeEntry.mesh.scale.set(0.2, 0.2, 0.2)
            new TweenScale(nodeEntry.mesh, 1.0, 180).start()
            this.selected = newId
            this.linkSourceId = newId
          }
          this._refreshNodeVisuals()
        }
      } else if (gesture === 'grab') {
        this.pinchActive = false
        if (this.selected && this.nodes.get(this.selected)) {
          const world = this.screenToWorldPoint(landmarks[8], 0.5)
          const node = this.nodes.get(this.selected)
          node.mesh.position.lerp(world, 0.25)
          this._updateConnectionsGeometryFor(node.id)
        }
      } else if (gesture === 'hold') {
        if (this.linkSourceId && this.hover && this.hover !== this.linkSourceId) {
          this.createConnection(this.linkSourceId, this.hover)
          this.selected = this.hover
          this.linkSourceId = null
          this._refreshNodeVisuals()
        }
      } else if (gesture === 'swipe') {
        this.pinchActive = false
        const now = performance.now()
        if (this.hover && now - this.lastDeleteAt > 420) {
          this.removeNode(this.hover)
          this.lastDeleteAt = now
        }
      } else if (gesture === 'openPalm') {
        this.pinchActive = false
        this.selected = null
        this.linkSourceId = null
        this.camera.position.set(0,2,6)
        this._refreshNodeVisuals()
      } else {
        this.pinchActive = false
      }
    } else {
      this.pinchActive = false
    }

    // update any active signal animations
    this._updateSignals(dt)
  }

  // update connection geometry for a given node id
  _updateConnectionsGeometryFor(nodeId) {
    this.connections.forEach(c => {
      if (c.aId === nodeId || c.bId === nodeId) {
        const a = this.nodes.get(c.aId).mesh.position
        const b = this.nodes.get(c.bId).mesh.position
        const pts = [a.clone(), b.clone()]
        c.line.geometry.setFromPoints(pts)
      }
    })
  }

  // Simulate a forward pass visualization:
  async runForward(inputArray, options = {}) {
    try {
      this._ensureNetwork(options)
      const expectedInputSize = this.network.sizes[0]
      const normalizedInput = Array.isArray(inputArray) && inputArray.length === expectedInputSize
        ? inputArray
        : new Array(expectedInputSize).fill(0).map(() => Math.random() * 2 - 1)
      const activations = await nnForward(this.network, normalizedInput)
      this._animateActivations(activations)
      return { input: normalizedInput, activations }
    } catch (err) {
      console.error('Forward error', err)
      throw err
    }
  }

  async trainBackprop(inputArray, targetArray, options = {}) {
    try {
      const network = this._ensureNetwork(options)
      const expectedInputSize = network.sizes[0]
      const expectedTargetSize = network.sizes[network.sizes.length - 1]
      const normalizedInput = Array.isArray(inputArray) && inputArray.length === expectedInputSize
        ? inputArray
        : new Array(expectedInputSize).fill(0).map(() => Math.random() * 2 - 1)
      const normalizedTarget = Array.isArray(targetArray) && targetArray.length === expectedTargetSize
        ? targetArray
        : new Array(expectedTargetSize).fill(0)

      const result = trainStep(network, normalizedInput, normalizedTarget, options.learningRate || 0.03)
      this._animateActivations(result.activations)
      return {
        input: normalizedInput,
        target: normalizedTarget,
        loss: result.loss,
        activations: result.activations
      }
    } catch (err) {
      console.error('Training error', err)
      throw err
    }
  }

  _animateActivations(activations) {
    this.animationTimers.forEach((timer) => clearTimeout(timer))
    this.animationTimers = []

    let layerIndex = 0
    activations.forEach((layerAct, layerIdx) => {
      const layer = this.layers[layerIndex]
      const prevLayer = this.layers[layerIndex - 1]
      if (!layer) {
        layerIndex += 1
        return
      }

      if (prevLayer) {
        const flowConnections = this.connections.filter((connection) => {
          const source = this.nodes.get(connection.aId)
          const target = this.nodes.get(connection.bId)
          return source && target && prevLayer.nodeIds.includes(connection.aId) && layer.nodeIds.includes(connection.bId)
        })

        flowConnections.forEach((connection, connectionIndex) => {
          const riseDelay = layerIdx * 260 + connectionIndex * 22
          this.animationTimers.push(setTimeout(() => {
            connection.line.material.color.set(0xf59e0b)
            connection.line.material.opacity = 0.9
          }, riseDelay))
          this.animationTimers.push(setTimeout(() => {
            connection.line.material.color.set(connection.baseColor)
            connection.line.material.opacity = connection.baseOpacity
          }, riseDelay + 320))
        })
      }

      layerAct.forEach((aVal, idx) => {
        const nodeId = layer.nodeIds[idx]
        const node = nodeId ? this.nodes.get(nodeId) : null
        if (node) {
          const intensity = Math.min(1, Math.max(0, (aVal + 1) / 2))
          const baseDelay = layerIdx * 260 + idx * 35
          this.animationTimers.push(setTimeout(() => {
            node.mesh.material = intensity > 0.66 ? this.nodePulseMat : this.nodeHighlightMat
            node.mesh.scale.setScalar(1 + intensity * 0.52)
          }, baseDelay))
          this.animationTimers.push(setTimeout(() => {
            node.mesh.scale.setScalar(1)
            this._refreshNodeVisuals()
          }, baseDelay + 360))
        }
      })
      layerIndex += 1
    })
  }

  applyPreset(preset) {
    if (!preset || !Array.isArray(preset.layers) || preset.layers.length < 2) return
    this.clear()
    preset.layers.forEach((size) => this.createLayerByCount(size))
    this.connectFeedForward()
    this._refreshNodeVisuals()
  }

  _updateSignals(dt) {
    // placeholder for connection-level signals
    // any per-frame signal updates would go here
  }

  dispose() {
    this.clear()
    this.nodeMaterial.dispose()
    this.nodeSelectedMat.dispose()
    this.nodeHighlightMat.dispose()
  }
}

// small helper for scaling tween (non-blocking)
class TweenScale {
  constructor(mesh, targetScale=1, duration=200) {
    this.mesh = mesh
    this.target = targetScale
    this.duration = duration
    this.start = performance.now()
    this.from = mesh.scale.x
    this.active = true
    this._tick = this._tick.bind(this)
  }
  _tick(t) {
    if (!this.active) return
    const p = Math.min(1, (t - this.start) / this.duration)
    const s = this.from + (this.target - this.from) * (1 - Math.cos(p * Math.PI)) / 2
    this.mesh.scale.set(s, s, s)
    if (p < 1) requestAnimationFrame(this._tick)
    else this.active = false
  }
  start() { requestAnimationFrame(this._tick) }
}