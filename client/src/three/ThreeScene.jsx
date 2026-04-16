import React, { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import NeuralScene from './NeuralScene.js'
import useGesture from '../gesture/useGesture.js'
import { getSharedCameraStream } from '../utils/cameraManager.js'
import { appStore } from '../state/store.js'

// ThreeScene: create renderer & NeuralScene once, then on each frame call neuralScene.update with the latest gesture from latestRef.
export default function ThreeScene() {
  const mountRef = useRef(null)
  const videoRef = useRef(document.createElement('video')) // offscreen for gesture detection
  videoRef.current.setAttribute('playsinline', true)
  videoRef.current.muted = true
  videoRef.current.autoplay = true

  // gesture hook (provides live values, used to update latestRef)
  const { landmarks, gesture, confidence } = useGesture(videoRef)

  // store latest gesture in a ref so the animation loop can read it without re-creating the whole scene
  const latestRef = useRef({ landmarks: null, gesture: null, confidence: 0 })
  useEffect(() => {
    latestRef.current = { landmarks, gesture, confidence }
    appStore.setState({
      gesture: {
        name: gesture,
        confidence
      }
    })
  }, [landmarks, gesture, confidence])

  // attach shared stream to the offscreen video (and expose for debugging)
  useEffect(() => {
    let mounted = true
    async function attachStream() {
      try {
        const stream = await getSharedCameraStream()
        if (!mounted) return
        if (videoRef.current.srcObject !== stream) {
          videoRef.current.srcObject = stream
          try { await videoRef.current.play() } catch (e) { /* autoplay may be restricted */ }
        }
        if (typeof window !== 'undefined') {
          window.__gestureVideo = videoRef.current
          window.__sharedStream = !!(videoRef.current && videoRef.current.srcObject)
        }
      } catch (err) {
        console.warn('Offscreen camera start failed', err)
        if (typeof window !== 'undefined') window.__sharedStream = false
      }
    }
    attachStream()
    return () => { mounted = false }
  }, [])

  // create the renderer and neuralScene once
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const width = mount.clientWidth || mount.offsetWidth || 800
    const height = mount.clientHeight || mount.offsetHeight || 600

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    mount.appendChild(renderer.domElement)

    // Scene / Camera
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x061025)
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000)
    camera.position.set(0, 2, 6)

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true

    // Lights
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6)
    hemi.position.set(0, 1, 0)
    scene.add(hemi)
    const dir = new THREE.DirectionalLight(0xffffff, 0.6)
    dir.position.set(5, 10, 7)
    scene.add(dir)

    // Neural scene manager (one instance)
    const neuralScene = new NeuralScene(scene, camera, renderer.domElement)
    if (typeof window !== 'undefined') window.__neuralScene = neuralScene

    // initial layered topology: input / hidden / output
    neuralScene.createLayerByCount(3)
    neuralScene.createLayerByCount(5)
    neuralScene.createLayerByCount(2)
    neuralScene.connectFeedForward()

    const publishStats = () => {
      appStore.setState({ scene: neuralScene.getStats() })
    }

    appStore.registerSceneActions({
      addLayer: (size) => {
        neuralScene.createLayerByCount(size)
        publishStats()
      },
      connectFeedForward: () => {
        neuralScene.connectFeedForward()
        publishStats()
      },
      clearNetwork: () => {
        neuralScene.clear()
        publishStats()
      },
      runForward: async ({ activation, dropout }) => {
        appStore.setState({ ui: { status: 'running' }, run: { error: null } })
        try {
          const result = await neuralScene.runForward(null, {
            activation,
            dropout
          })
          appStore.setState({
            run: {
              lastInput: result.input,
              lastActivations: result.activations,
              error: null
            },
            ui: { status: 'idle' }
          })
          return result
        } catch (err) {
          appStore.setState({
            run: {
              error: err?.message || String(err)
            },
            ui: { status: 'idle' }
          })
          throw err
        }
      }
    })
    publishStats()

    let lastT = performance.now()
    let raf = null
    const animate = (t) => {
      const dt = (t - lastT) / 1000
      lastT = t
      controls.update()
      // pass the latest gesture state snapshot into neuralScene.update
      try {
        neuralScene.update(dt, latestRef.current)
      } catch (err) {
        console.warn('neuralScene.update error', err)
      }
      renderer.render(scene, camera)
      raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)

    const onResize = () => {
      const w = mount.clientWidth || window.innerWidth
      const h = mount.clientHeight || window.innerHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      if (raf) cancelAnimationFrame(raf)
      try {
        neuralScene.dispose()
        appStore.registerSceneActions(null)
        if (typeof window !== 'undefined') window.__neuralScene = null
      } catch (e) {}
      mount.removeChild(renderer.domElement)
    }
    // empty deps: only run once on mount
  }, [])

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
}