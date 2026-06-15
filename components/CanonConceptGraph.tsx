"use client";
import { useMemo, useEffect } from "react";
import {
  ReactFlow, Background, Controls, MiniMap,
  Handle, Position, useNodesState, useEdgesState,
  type Node, type NodeProps, type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import Dagre from "@dagrejs/dagre";

export interface CanonConceptNode extends Record<string, unknown> {
  id: string;
  name: string;
  difficulty: "FOUNDATIONAL" | "INTERMEDIATE" | "ADVANCED";
  category: string;
  unlocks: string[];
  isSelected: boolean;
  onClick: () => void;
}

const DIFF_COLOR: Record<string, string> = {
  FOUNDATIONAL: "#4ade80",
  INTERMEDIATE: "#c9a84c",
  ADVANCED:     "#f87171",
};

function ConceptNode({ data }: NodeProps & { data: CanonConceptNode }) {
  const color = DIFF_COLOR[data.difficulty] ?? "#c9a84c";
  return (
    <div
      onClick={data.onClick}
      style={{
        border: `2px solid ${data.isSelected ? color : "#2d3748"}`,
        borderRadius: 8,
        padding: "7px 11px",
        background: data.isSelected ? "#1e2840" : "#1c2333",
        minWidth: 150,
        cursor: "pointer",
        boxShadow: data.isSelected ? `0 0 14px ${color}50` : "none",
        transition: "box-shadow 0.15s, border-color 0.15s",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: "#2d3748", border: "1px solid #444" }} />
      <div style={{ color, fontSize: 11, fontWeight: "bold", fontFamily: "Georgia, serif", lineHeight: 1.3, marginBottom: 2 }}>
        {data.name}
      </div>
      <div style={{ fontSize: 9, color: "#4b5563" }}>{data.category}</div>
      <Handle type="source" position={Position.Right} style={{ background: "#2d3748", border: "1px solid #444" }} />
    </div>
  );
}

const nodeTypes = { concept: ConceptNode };

function buildLayout(
  concepts: CanonConceptNode[],
): { nodes: Node[]; edges: Edge[] } {
  const validIds = new Set(concepts.map(c => c.id));
  const g = new Dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 44, ranksep: 110, marginx: 40, marginy: 40 });

  concepts.forEach(c => g.setNode(c.id, { width: 162, height: 52 }));
  concepts.forEach(c =>
    c.unlocks?.forEach(u => { if (validIds.has(u)) g.setEdge(c.id, u); })
  );
  Dagre.layout(g);

  const nodes: Node[] = concepts.map(c => ({
    id: c.id,
    type: "concept",
    position: { x: g.node(c.id).x - 81, y: g.node(c.id).y - 26 },
    data: c,
  }));

  const edges: Edge[] = [];
  concepts.forEach(c =>
    c.unlocks?.forEach(u => {
      if (validIds.has(u))
        edges.push({
          id: `${c.id}->${u}`,
          source: c.id,
          target: u,
          style: { stroke: "#2d3748", strokeWidth: 1.5 },
          markerEnd: { type: "arrowclosed" as const, color: "#2d3748" },
        });
    })
  );

  return { nodes, edges };
}

export default function CanonConceptGraph({
  concepts,
  selectedId,
  onSelect,
}: {
  concepts: CanonConceptNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const conceptsWithHandlers = useMemo(
    () => concepts.map(c => ({ ...c, isSelected: c.id === selectedId, onClick: () => onSelect(c.id) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [concepts, selectedId]
  );

  const { nodes: initNodes, edges: initEdges } = useMemo(
    () => buildLayout(conceptsWithHandlers),
    [conceptsWithHandlers]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes);
  const [edges, , onEdgesChange] = useEdgesState(initEdges);

  // Keep selection state in sync without full remount
  useEffect(() => {
    setNodes(nds =>
      nds.map(n => ({
        ...n,
        data: {
          ...(n.data as CanonConceptNode),
          isSelected: n.id === selectedId,
          onClick: () => onSelect(n.id),
        },
      }))
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return (
    <div style={{ height: "100%", background: "#0d1117", borderRadius: 8, overflow: "hidden" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2.5}
      >
        <Background color="#1a2234" gap={24} size={1} />
        <Controls style={{ background: "#1c2333", border: "1px solid #2d3748" }} />
        <MiniMap
          nodeColor={n => DIFF_COLOR[(n.data as CanonConceptNode)?.difficulty] ?? "#c9a84c"}
          style={{ background: "#161b27", border: "1px solid #2d3748" }}
          maskColor="rgba(13,17,23,0.7)"
        />
      </ReactFlow>
    </div>
  );
}
