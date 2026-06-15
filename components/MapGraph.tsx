"use client";
import { useMemo } from "react";
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

export interface TopicNodeData extends Record<string, unknown> {
  slug: string;
  label: string;
  foundational: number;
  intermediate: number;
  advanced: number;
  workCount: number;
  firstSeen?: number;
  onClick: () => void;
}

function TopicNode({ data, selected }: NodeProps & { data: TopicNodeData }) {
  const totalConcepts = data.foundational + data.intermediate + data.advanced;
  const dots = [
    ...Array(Math.min(data.foundational, 10)).fill("#4ade80"),
    ...Array(Math.min(data.intermediate, 10)).fill("#c9a84c"),
    ...Array(Math.min(data.advanced, 10)).fill("#f87171"),
  ];

  return (
    <div
      onClick={data.onClick}
      style={{
        border: `2px solid ${selected ? "#c9a84c" : "#2d3748"}`,
        borderRadius: 10,
        padding: "14px 16px",
        background: selected ? "#222940" : "#1c2333",
        minWidth: 210,
        cursor: "pointer",
        boxShadow: selected ? "0 0 14px rgba(201,168,76,0.3)" : "none",
        transition: "background 0.15s, box-shadow 0.15s",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: "#2d3748", border: "1px solid #444" }} />

      <div style={{ color: "#c9a84c", fontFamily: "Georgia, serif", fontSize: 14, fontWeight: "bold", marginBottom: 10, lineHeight: 1.3 }}>
        {data.label}
      </div>

      {/* Difficulty dots */}
      <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 8 }}>
        {dots.map((color, i) => (
          <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: color, opacity: 0.85 }} />
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, fontSize: 11, color: "#6b7280" }}>
        <span>{totalConcepts} concepts</span>
        {data.workCount > 0 && <span>{data.workCount} works</span>}
      </div>

      {data.firstSeen && (
        <div style={{ fontSize: 10, color: "#4b5563", marginTop: 4 }}>
          {new Date(data.firstSeen).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </div>
      )}

      <Handle type="source" position={Position.Right} style={{ background: "#2d3748", border: "1px solid #444" }} />
    </div>
  );
}

const nodeTypes = { topic: TopicNode };

function buildLayout(
  topics: TopicNodeData[]
): { nodes: Node[]; edges: Edge[] } {
  const g = new Dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 80, ranksep: 160, marginx: 50, marginy: 50 });

  topics.forEach(t => g.setNode(t.slug, { width: 230, height: 120 }));

  // Edges: compute shared concept names between topics (passed via edge metadata)
  // Edges are built externally and passed in as edgeList
  Dagre.layout(g);

  const nodes: Node[] = topics.map(t => ({
    id: t.slug,
    type: "topic",
    position: { x: g.node(t.slug).x - 115, y: g.node(t.slug).y - 60 },
    data: t,
  }));

  return { nodes, edges: [] };
}

export default function MapGraph({
  topics,
  edges: externalEdges,
  onSelect,
}: {
  topics: TopicNodeData[];
  edges: { source: string; target: string; label: string }[];
  onSelect: (slug: string) => void;
}) {
  const topicsWithClick = useMemo(
    () => topics.map(t => ({ ...t, onClick: () => onSelect(t.slug) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [topics]
  );

  const { nodes: layoutNodes } = useMemo(() => buildLayout(topicsWithClick), [topicsWithClick]);

  const builtEdges: Edge[] = useMemo(
    () =>
      externalEdges.map(e => ({
        id: `${e.source}->${e.target}`,
        source: e.source,
        target: e.target,
        label: e.label,
        style: { stroke: "#2d3748", strokeWidth: 1.5 },
        labelStyle: { fill: "#6b7280", fontSize: 10, fontFamily: "Georgia, serif" },
        labelBgStyle: { fill: "#1c2333" },
        markerEnd: { type: "arrowclosed" as const, color: "#2d3748" },
      })),
    [externalEdges]
  );

  const [nodes, , onNodesChange] = useNodesState(layoutNodes);
  const [edges, , onEdgesChange] = useEdgesState(builtEdges);

  return (
    <div style={{ height: "100%", borderRadius: 8, overflow: "hidden", background: "#0d1117" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
      >
        <Background color="#1e2a3a" gap={24} size={1} />
        <Controls style={{ background: "#1c2333", border: "1px solid #2d3748" }} />
        <MiniMap
          nodeColor={() => "#c9a84c"}
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
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
            <span style={{ fontSize: 11, color: "#a09080", fontFamily: "Georgia, serif" }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
