import React, { useEffect, useState } from "react";

export default function DebugOverlay() {
  const [tick, setTick] = useState(0);
  const [tfMemory, setTfMemory] = useState(null);
  const hasWindow = typeof window !== "undefined";

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 400);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (hasWindow && window.tf && typeof window.tf.memory === "function") {
      try {
        setTfMemory(window.tf.memory());
      } catch (e) {
        setTfMemory({ error: String(e) });
      }
    } else {
      setTfMemory(null);
    }
  }, [hasWindow, tick]);

  const neuralScene = hasWindow ? window.__neuralScene || null : null;

  return (
    <div
      style={{
        width: "100%",
        maxHeight: "30vh",
        overflow: "auto",
        background: "rgba(2, 9, 22, 0.65)",
        color: "white",
        fontSize: 12,
        padding: 8,
        borderRadius: 6,
        border: "1px solid rgba(148, 163, 184, 0.18)",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>DEBUG OVERLAY</div>

      <div style={{ marginTop: 6 }}>
        <b>NeuralScene</b>: {neuralScene ? "present" : "not present"}
      </div>
      <div>
        {neuralScene
          ? `nodes: ${neuralScene.nodes ? neuralScene.nodes.size : "—"}, connections: ${neuralScene.connections ? neuralScene.connections.length : "—"}`
          : ""}
      </div>

      <div style={{ marginTop: 6 }}>
        <b>tf.memory()</b>: {" "}
        {tfMemory ? JSON.stringify(tfMemory) : "tf not available"}
      </div>

      <div style={{ marginTop: 6, fontSize: 11, color: "#ddd" }}>
        Open console and inspect window.__neuralScene for more details.
      </div>
    </div>
  );
}
