"use client";
import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import Dagre from "@dagrejs/dagre";

export interface ConceptItem {
  id: string;
  name: string;
  description: string;
  difficulty: "FOUNDATIONAL" | "INTERMEDIATE" | "ADVANCED";
  prerequisites: string[];
  unlocks: string[];
  category: string;
  key_works?: string[];
}

const DIFF_COLOR: Record<string, string> = {
  FOUNDATIONAL: "#4ade80",
  INTERMEDIATE: "#c9a84c",
  ADVANCED: "#f87171",
};

type ConceptNodeData = { concept: ConceptItem; onClick: (c: ConceptItem) => void };

function ConceptNode({ data, selected }: NodeProps & { data: ConceptNodeData }) {
  const c = data.concept;
  const border = DIFF_COLOR[c.difficulty] ?? "#2d3748";
  return (
    <div
      onClick={() => data.onClick(c)}
      style={{
        border: `2px solid ${selected ? "#e8dcc8" : border}`,
        borderRadius: 8,
        padding: "10px 14px",
        background: selected ? "#222940" : "#1c2333",
        minWidth: 170,
        maxWidth: 220,
        cursor: "pointer",
        boxShadow: selected ? `0 0 12px ${border}60` : "none",
        transition: "background 0.15s, box-shadow 0.15s",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: "#2d3748", border: "1px solid #444" }} />
      <div style={{ color: "#e8dcc8", fontFamily: "Georgia, serif", fontSize: 13, fontWeight: "bold", marginBottom: c.key_works?.length ? 6 : 0 }}>
        {c.name}
      </div>
      {c.key_works?.map(w => (
        <div key={w} style={{ fontSize: 10, color: "#a09080", lineHeight: 1.4 }}>📚 {w}</div>
      ))}
      <Handle type="source" position={Position.Right} style={{ background: "#2d3748", border: "1px solid #444" }} />
    </div>
  );
}

const nodeTypes = { concept: ConceptNode };

function buildLayout(concepts: ConceptItem[], onClick: (c: ConceptItem) => void): { nodes: Node[]; edges: Edge[] } {
  const g = new Dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 70, ranksep: 130, marginx: 40, marginy: 40 });

  const idSet = new Set(concepts.map(c => c.id));

  concepts.forEach(c => g.setNode(c.id, { width: 220, height: 80 }));
  concepts.forEach(c =>
    c.unlocks.forEach(targetId => {
      if (idSet.has(targetId)) g.setEdge(c.id, targetId);
    })
  );

  Dagre.layout(g);

  const nodes: Node[] = concepts.map(c => ({
    id: c.id,
    type: "concept",
    position: { x: g.node(c.id).x - 110, y: g.node(c.id).y - 40 },
    data: { concept: c, onClick } as ConceptNodeData,
  }));

  const edges: Edge[] = [];
  concepts.forEach(c =>
    c.unlocks.forEach(targetId => {
      if (idSet.has(targetId)) {
        edges.push({
          id: `${c.id}->${targetId}`,
          source: c.id,
          target: targetId,
          style: { stroke: "#2d3748", strokeWidth: 1.5 },
          markerEnd: { type: "arrowclosed" as const, color: "#2d3748" },
        });
      }
    })
  );

  return { nodes, edges };
}

export default function ConceptGraph({
  concepts,
  onSelect,
}: {
  concepts: ConceptItem[];
  onSelect: (c: ConceptItem) => void;
}) {
  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(
    () => buildLayout(concepts, onSelect),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [concepts]
  );

  const [nodes, , onNodesChange] = useNodesState(layoutNodes);
  const [edges, , onEdgesChange] = useEdgesState(layoutEdges);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onSelect((node.data as ConceptNodeData).concept);
    },
    [onSelect]
  );

  return (
    <div style={{ height: 620, borderRadius: 8, border: "1px solid var(--border)", overflow: "hidden", background: "#0d1117" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.3}
        maxZoom={2}
      >
        <Background color="#1e2a3a" gap={24} size={1} />
        <Controls
          style={{ background: "#1c2333", border: "1px solid #2d3748" }}
        />
        <MiniMap
          nodeColor={n => {
            const d = (n.data as ConceptNodeData)?.concept?.difficulty;
            return DIFF_COLOR[d] ?? "#2d3748";
          }}
          style={{ background: "#161b27", border: "1px solid #2d3748" }}
          maskColor="rgba(13,17,23,0.7)"
        />
      </ReactFlow>

      {/* Legend */}
      <div style={{
        position: "absolute",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        gap: 20,
        background: "rgba(22,27,39,0.9)",
        border: "1px solid #2d3748",
        borderRadius: 6,
        padding: "6px 14px",
        pointerEvents: "none",
      }}>
        {[["#4ade80", "Foundational"], ["#c9a84c", "Intermediate"], ["#f87171", "Advanced"]].map(([color, label]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
            <span style={{ fontSize: 11, color: "#a09080", fontFamily: "Georgia, serif" }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
