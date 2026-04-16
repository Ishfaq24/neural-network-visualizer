import { useSyncExternalStore } from 'react'

const initialState = {
	scene: {
		nodeCount: 0,
		connectionCount: 0,
		layerSizes: []
	},
	gesture: {
		name: null,
		confidence: 0
	},
	run: {
		lastInput: null,
		lastActivations: null,
		lastTarget: null,
		lastLoss: null,
		error: null
	},
	ui: {
		status: 'idle'
	}
}

let state = initialState
const listeners = new Set()
let sceneActions = null

function emit() {
	listeners.forEach((listener) => listener())
}

function setState(patch) {
	state = {
		...state,
		...patch,
		scene: {
			...state.scene,
			...(patch.scene || {})
		},
		gesture: {
			...state.gesture,
			...(patch.gesture || {})
		},
		run: {
			...state.run,
			...(patch.run || {})
		},
		ui: {
			...state.ui,
			...(patch.ui || {})
		}
	}
	emit()
}

function subscribe(listener) {
	listeners.add(listener)
	return () => listeners.delete(listener)
}

function getState() {
	return state
}

function getSceneActions() {
	return sceneActions
}

function registerSceneActions(actions) {
	sceneActions = actions
}

export function useAppStore(selector = (s) => s) {
	return useSyncExternalStore(subscribe, () => selector(state), () => selector(state))
}

export const appStore = {
	getState,
	setState,
	subscribe,
	registerSceneActions,
	getSceneActions,
	reset() {
		state = initialState
		sceneActions = null
		emit()
	}
}
