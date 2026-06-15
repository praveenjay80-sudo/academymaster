"use client";
import { forwardRef, useEffect, useImperativeHandle } from "react";
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  Handle, Position, useNodesState, useEdgesState, useReactFlow,
  type Node, type NodeProps, type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import Dagre from "@dagrejs/dagre";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface KSFigure {
  name: string;
  years: string;
  contribution: string;
  surprising_fact: string;
}

export interface KSWork {
  title: string;
  authors: string[];
  year: number;
  category: "PEDAGOGICAL" | "SEMINAL" | "BREAKTHROUGH";
  why_essential: string;
  what_you_gain: string;
  reading_time: string;
}

export interface KSHistoricalMoment {
  year: number;
  title: string;
  description: string;
  significance: string;
}

export type KSLevel = "FOUNDATIONAL" | "INTERMEDIATE" | "ADVANCED" | "SPECIALIZATION" | "RESEARCH";

export interface KSConcept {
  _type: "concept";
  id: string;
  name: string;
  level: KSLevel;
  category: string;
  description: string;
  analogy: string;
  prerequisites: string[];
  unlocks: string[];
  figures: KSFigure[];
  works: KSWork[];
  historical_moment: KSHistoricalMoment | null;
  milestone: string;
}

export interface KSNodeData extends Record<string, unknown> {
  concept: KSConcept;
  isSelected: boolean;
  index: number;
}

// ── Constants ──────────────────────────────────────────────────────────────────

export const LEVEL_COLOR: Record<KSLevel, string> = {
  FOUNDATIONAL:   "#4ade80",
  INTERMEDIATE:   "#60a5fa",
  ADVANCED:       "#c9a84c",
  SPECIALIZATION: "#a78bfa",
  RESEARCH:       "#fb923c",
};

const NODE_W = 170;
const NODE_H = 58;

// ── Edge builder ───────────────────────────────────────────────────────────────

function mkEdge(source: string, target: string): Edge {
  return {
    id: `${source}->${target}`,
    source,
    target,
    style: { stroke: "#2d3748", strokeWidth: 1.5 },
    markerEnd: { type: "arrowclosed" as const, color: "#2d3748" },
  };
}

export function buildEdges(concepts: KSConcept[]): Edge[] {
  const validIds = new Set(concepts.map(c => c.id));
  const edgeMap = new Map<string, Edge>();
  concepts.forEach(c => {
    c.unlocks?.forEach(u => { if (validIds.has(u)) edgeMap.set(`${c.id}->${u}`, mkEdge(c.id, u)); });
    c.prerequisites?.forEach(p => { if (validIds.has(p)) edgeMap.set(`${p}->${c.id}`, mkEdge(p, c.id)); });
  });
  return [...edgeMap.values()];
}

export function buildLayout(concepts: KSConcept[]): { nodes: Node<KSNodeData>[]; edges: Edge[] } {
  const edges = buildEdges(concepts);
  const g = new Dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "BT", nodesep: 60, ranksep: 100, marginx: 48, marginy: 48 });

  concepts.forEach(c => g.setNode(c.id, { width: NODE_W, height: NODE_H }));
  edges.forEach(e => { try { g.setEdge(e.source, e.target); } catch { /**/ } });
  Dagre.layout(g);

  const nodes: Node<KSNodeData>[] = concepts.map((c, index) => {
    const pos = g.node(c.id);
    return {
      id: c.id,
      type: "ks-concept",
      position: { x: (pos?.x ?? index * 200) - NODE_W / 2, y: (pos?.y ?? 0) - NODE_H / 2 },
      data: { concept: c, isSelected: false, index },
    };
  });

  return { nodes, edges };
}

// ── Custom node ────────────────────────────────────────────────────────────────

function KSConceptNode({ data }: NodeProps & { data: KSNodeData }) {
  const lc = LEVEL_COLOR[data.concept.level] ?? "#c9a84c";
  return (
    <div style={{
      border: `2px solid ${data.isSelected ? lc : "#2d3748"}`,
      borderLeft: `4px solid ${lc}`,
      borderRadius: 8,
      padding: "8px 10px",
      background: data.isSelected ? "#1e2840" : "#1c2333",
      width: NODE_W,
      cursor: "pointer",
      boxShadow: data.isSelected ? `0 0 18px ${lc}50` : "none",
      transition: "box-shadow 0.15s, border-color 0.15s, background 0.15s",
      animation: `ksNodeIn 0.35s ease-out ${Math.min(data.index * 0.04, 0.8)}s both`,
    }}>
      <Handle type="target" position={Position.Bottom} style={{ background: "#2d3748", border: "1px solid #444" }} />
      <div style={{ color: data.isSelected ? lc : "#e8dcc8", fontSize: 12, fontWeight: "bold", fontFamily: "Georgia, serif", lineHeight: 1.3, marginBottom: 2 }}>
        {data.concept.name}
      </div>
      <div style={{ fontSize: 9, color: "#4b5563" }}>{data.concept.category}</div>
      <Handle type="source" position={Position.Top} style={{ background: "#2d3748", border: "1px solid #444" }} />
    </div>
  );
}

const nodeTypes = { "ks-concept": KSConceptNode };

// ── Focus controller (rendered inside ReactFlow, has context access) ───────────

function FocusController({ focusRef }: {
  focusRef: React.Ref<KnowledgeSpaceGraphHandle>;
}) {
  const rf = useReactFlow();

  useImperativeHandle(focusRef, () => ({
    focusNode(id: string) {
      const node = rf.getNode(id);
      if (node) {
        rf.setCenter(
          node.position.x + NODE_W / 2,
          node.position.y + NODE_H / 2,
          { zoom: 1.3, duration: 600 }
        );
      }
    },
    fitAll() {
      rf.fitView({ padding: 0.15, duration: 600 });
    },
  }));

  return null;
}

// ── Ref handle ─────────────────────────────────────────────────────────────────

export interface KnowledgeSpaceGraphHandle {
  focusNode: (id: string) => void;
  fitAll: () => void;
}

// ── Inner flow (wrapped by ReactFlowProvider) ─────────────────────────────────

function KSFlowInner({
  initNodes, initEdges, selectedId, onSelect, focusRef,
}: {
  initNodes: Node<KSNodeData>[];
  initEdges: Edge[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  focusRef: React.Ref<KnowledgeSpaceGraphHandle>;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes);
  const [edges, , onEdgesChange] = useEdgesState(initEdges);

  // Sync selection state
  useEffect(() => {
    setNodes(nds =>
      nds.map(n => ({
        ...n,
        data: { ...(n.data as KSNodeData), isSelected: n.id === selectedId },
      }))
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={(_, node) => onSelect(node.id)}
      onInit={inst => { setTimeout(() => inst.fitView({ padding: 0.15, duration: 700 }), 80); }}
      minZoom={0.05}
      maxZoom={2.5}
      attributionPosition="bottom-left"
    >
      <style>{`
        @keyframes ksNodeIn {
          from { opacity: 0; transform: scale(0.8); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
      <FocusController focusRef={focusRef} />
      <Background color="#1a2234" gap={24} size={1} />
      <Controls style={{ background: "#1c2333", border: "1px solid #2d3748" }} />
      <MiniMap
        nodeColor={n => LEVEL_COLOR[(n.data as KSNodeData)?.concept?.level] ?? "#c9a84c"}
        style={{ background: "#161b27", border: "1px solid #2d3748" }}
        maskColor="rgba(13,17,23,0.7)"
      />
    </ReactFlow>
  );
}

// ── Exported component ─────────────────────────────────────────────────────────

const KnowledgeSpaceGraph = forwardRef<KnowledgeSpaceGraphHandle, {
  nodes: Node<KSNodeData>[];
  edges: Edge[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}>(function KnowledgeSpaceGraph({ nodes, edges, selectedId, onSelect }, ref) {
  return (
    <ReactFlowProvider>
      <KSFlowInner
        initNodes={nodes}
        initEdges={edges}
        selectedId={selectedId}
        onSelect={onSelect}
        focusRef={ref}
      />
    </ReactFlowProvider>
  );
});

export default KnowledgeSpaceGraph;
