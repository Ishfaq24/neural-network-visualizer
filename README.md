# Neural Network Visualizer

Interactive 3D neural-network playground built with React, Three.js, and TensorFlow.js.

You can:
- Build layer topologies (manually or via presets)
- Auto-connect feedforward edges
- Run forward passes with activation + dropout controls
- Train with backpropagation (target vector, learning rate, steps)
- Watch animated activation flow through nodes and connections

## Tech Stack

- Frontend: React + Vite
- 3D Rendering: Three.js
- ML Math: TensorFlow.js
- Backend: Node.js + Express (optional service layer)

## Project Structure

```text
client/   React + Three.js visualizer
server/   Express server
```

## Prerequisites

- Node.js 18+
- npm 9+

## Installation

From the repository root:

```bash
cd client
npm install

cd ../server
npm install
```

## Run The App

Start frontend (recommended):

```bash
cd client
npm run dev
```

Frontend default URL:
- http://localhost:5173

Optional backend:

```bash
cd server
npm start
```

## Build Frontend

```bash
cd client
npm run build
```

## How To Use

1. Pick a preset (`Tiny`, `Medium`, `Deep`) or build layers manually.
2. Use `Auto Connect` to create feedforward connections.
3. Configure activation and dropout.
4. Click `Run Forward` to simulate activations.
5. Use `Backpropagation` controls:
	- Target output vector (comma-separated)
	- Learning rate
	- Steps
6. Click `Train Backprop` and observe updated loss + activations.

## Backpropagation Notes

- Training uses gradient-based optimization on current network topology.
- Target vector size must match output layer size.
- Dropout is applied in forward simulation, while training uses deterministic forward for stable gradients.

## Current Status

- UI is tuned to a light editorial style.
- Forward animation includes node pulses and connection flow highlights.
- Backprop training is available as an interactive panel action.

## Troubleshooting

- If the app does not start, ensure dependencies are installed in both `client` and `server`.
- If build warns about chunk size, it is currently non-blocking.
- If training errors occur, verify output layer size and target vector length.

## License

No license file is currently included.
