import * as tf from '@tensorflow/tfjs'

export function ActivationFactory(name) {
  switch (name) {
    case 'sigmoid': return (x) => tf.sigmoid(x)
    case 'tanh': return (x) => tf.tanh(x)
    case 'relu':
    default: return (x) => tf.relu(x)
  }
}

if (typeof window !== 'undefined' && !window.tf) {
  window.tf = tf
}


// create a simple fully connected network representation
export function createNetwork(layerSizes = [3, 4, 2], activation = 'relu', dropout = 0) {
  const weights = []
  const biases = []
  for (let i = 0; i < layerSizes.length - 1; i++) {
    const inSize = layerSizes[i]
    const outSize = layerSizes[i + 1]
    const std = Math.sqrt(2 / (inSize + outSize))
    const w = tf.randomNormal([outSize, inSize], 0, std)
    const b = tf.zeros([outSize, 1])
    weights.push(w)
    biases.push(b)
  }
  return {
    sizes: layerSizes,
    weights,
    biases,
    activation: activation,
    dropout: Math.max(0, Math.min(0.9, dropout))
  }
}

// forward propagation returns array of activations per layer (plain JS arrays)
export function forward(network, inputArr) {
  if (inputArr.length !== network.sizes[0]) {
    throw new Error('Input size mismatch')
  }

  const activationsTensors = []
  try {
    let a = tf.tensor(inputArr, [network.sizes[0], 1])
    activationsTensors.push(a)
    const actFn = ActivationFactory(network.activation)
    for (let i = 0; i < network.weights.length; i++) {
      let z = tf.add(tf.matMul(network.weights[i], a), network.biases[i])
      a = actFn(z)
      if (network.dropout > 0) {
        const keepProb = 1 - network.dropout
        const mask = tf.randomUniform(a.shape, 0, 1).less(keepProb).cast('float32')
        a = tf.mul(a, mask)
      }
      activationsTensors.push(a)
    }

    // Convert tensors to JS arrays synchronously (arraySync) while tensors are still alive.
    const activations = activationsTensors.map(t => {
      const arr = t.arraySync()
      // arr is nested [[v],[v],...] => flatten to 1D
      const flat = Array.isArray(arr) ? arr.map(v => (Array.isArray(v) ? v[0] : v)) : [arr]
      return flat
    })

    return activations
  } finally {
    // Dispose tensors we created in this function (but DO NOT dispose network.weights/biases here)
    activationsTensors.forEach(t => t && t.dispose && t.dispose())
  }
}

// utilities to dispose tensors in network
export function disposeNetwork(network) {
  network.weights.forEach(w => w.dispose && w.dispose())
  network.biases.forEach(b => b.dispose && b.dispose())
}