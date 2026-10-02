import { memo, useEffect, useMemo, useRef } from 'react';
import {
  Background,
  BackgroundVariant,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/base.css';
import { MonoText } from '@/components/atoms/MonoText';
import { cn } from '@/lib/cn';
import { shortUuid } from '@/lib/itemLabel';
import { typeColor } from '@/lib/objectTypes';
import type { OrbitEdge, OrbitNode } from '@/lib/orbitLayout';

interface OrbitGraphProps {
  nodes: OrbitNode[];
  edges: OrbitEdge[];
  selectedId: string | undefined;
  /** `more` labels the "more" node of an open cluster (one per open cluster). */
  labels: { more: (objectType: string) => string };
  /** Click on an entity: inspect it. */
  onSelect: (uuid: string) => void;
  /** Double-click on an entity: centre the graph on it. */
  onRecenter: (uuid: string) => void;
  onToggleCluster: (objectType: string) => void;
  onMore: (objectType: string) => void;
}

type GraphNodeData = { node: OrbitNode; selected: boolean; moreLabel: string };
type GraphNode = Node<GraphNodeData>;

/** Invisible centred handle: edges are straight lines between node centres. */
const CenterHandles = () => (
  <>
    <Handle
      type="target"
      position={Position.Top}
      isConnectable={false}
      className="!top-1/2 !left-1/2 !size-px !min-w-0 !border-0 !opacity-0"
    />
    <Handle
      type="source"
      position={Position.Top}
      isConnectable={false}
      className="!top-1/2 !left-1/2 !size-px !min-w-0 !border-0 !opacity-0"
    />
  </>
);

const OrbitNodeView = memo(function OrbitNodeView({ data }: NodeProps<GraphNode>) {
  const { node, selected, moreLabel } = data;

  if (node.kind === 'center') {
    const color = typeColor(node.entity.objectType);
    return (
      <div
        className="flex size-29 flex-col items-center justify-center gap-1 rounded-full border-2 bg-background px-2.5 text-center shadow-lg"
        style={{
          borderColor: color,
          boxShadow: `0 0 0 8px color-mix(in oklab, ${color} 14%, transparent)`,
        }}
      >
        <MonoText tone="muted" className="text-3xs">
          {node.entity.objectType}
        </MonoText>
        <span className="line-clamp-2 text-sm leading-tight font-semibold">
          {node.entity.label}
        </span>
        <MonoText tone="subtle" className="text-3xs">
          {shortUuid(node.entity.uuid)}
        </MonoText>
        <CenterHandles />
      </div>
    );
  }

  if (node.kind === 'cluster') {
    const size = Math.round(Math.min(78, 34 + Math.log2(node.total + 1) * 7));
    return (
      <div className="relative flex flex-col items-center">
        <div
          className={cn(
            'grid place-items-center rounded-full border-2 bg-background font-mono text-sm font-semibold transition-opacity',
            node.open ? 'opacity-100 shadow-md' : 'opacity-85 hover:opacity-100',
          )}
          style={{ width: size, height: size, borderColor: typeColor(node.objectType) }}
        >
          {node.total}
        </div>
        <MonoText className="absolute top-full mt-1.5 rounded border bg-background px-1.5 py-0.5 text-2xs whitespace-nowrap">
          {node.objectType}
        </MonoText>
        <CenterHandles />
      </div>
    );
  }

  if (node.kind === 'more') {
    return (
      <div className="rounded-full border border-dashed border-line-strong bg-background px-2.5 py-1 font-mono text-2xs text-fg-2 whitespace-nowrap">
        {moreLabel}
        <CenterHandles />
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-center gap-1.5" title={node.entity.uuid}>
      <span
        className={cn(
          'size-3.5 rounded-full',
          node.entity.missing && 'border-2 border-dashed border-destructive bg-transparent!',
        )}
        style={{
          background: typeColor(node.entity.objectType),
          boxShadow: selected ? '0 0 0 4px var(--ds-acc-bg), 0 0 0 5px var(--ds-acc)' : undefined,
        }}
      />
      <span
        className={cn(
          'rounded bg-surface-2 px-1 text-2xs leading-none whitespace-nowrap',
          selected ? 'font-semibold text-foreground' : 'text-fg-2',
          node.entity.missing && 'text-destructive line-through',
        )}
      >
        {node.entity.label}
      </span>
      <CenterHandles />
    </div>
  );
});

const nodeTypes = { orbit: OrbitNodeView };

const edgeStyle: Record<OrbitEdge['kind'], React.CSSProperties> = {
  parent: { stroke: 'var(--ds-fg-3)', strokeWidth: 1.5 },
  cluster: { stroke: 'var(--ds-line-2)', strokeWidth: 1.5 },
  child: { stroke: 'var(--ds-line-2)', strokeWidth: 1, opacity: 0.8 },
  ref: { stroke: 'var(--ds-fg-3)', strokeWidth: 1.2, strokeDasharray: '5 4' },
};

/** Navigable orbit graph (React Flow): pan, zoom, click to inspect, double-click to re-centre. */
export function OrbitGraph(props: OrbitGraphProps) {
  return (
    <ReactFlowProvider>
      <Graph {...props} />
    </ReactFlowProvider>
  );
}

/** Delay before a single click selects, leaving room for a second click to re-centre. */
const DOUBLE_CLICK_MS = 250;

/**
 * Tells a click from a double-click on graph entities. Selecting on the first click would
 * re-render the graph and lose the second one, so the single click waits a moment.
 */
function useClickOrDoubleClick(
  onClick: (uuid: string) => void,
  onDoubleClick: (uuid: string) => void,
) {
  const pending = useRef<{ uuid: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  useEffect(() => () => clearTimeout(pending.current?.timer), []);
  return {
    click(uuid: string, canDoubleClick: boolean) {
      if (pending.current?.uuid === uuid) {
        clearTimeout(pending.current.timer);
        pending.current = null;
        if (canDoubleClick) onDoubleClick(uuid);
        return;
      }
      clearTimeout(pending.current?.timer);
      pending.current = {
        uuid,
        timer: setTimeout(() => {
          pending.current = null;
          onClick(uuid);
        }, DOUBLE_CLICK_MS),
      };
    },
  };
}

/** Re-frames the view whenever the set of nodes changes (cluster opened, new centre). */
function FitOnChange({ signature }: { signature: string }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    const frame = requestAnimationFrame(() => void fitView({ padding: 0.15, duration: 300 }));
    return () => cancelAnimationFrame(frame);
  }, [signature, fitView]);
  return null;
}

function Graph({
  nodes,
  edges,
  selectedId,
  labels,
  onSelect,
  onRecenter,
  onToggleCluster,
  onMore,
}: OrbitGraphProps) {
  const flowNodes: GraphNode[] = useMemo(
    () =>
      nodes.map((node) => ({
        id: node.id,
        type: 'orbit',
        position: { x: node.x, y: node.y },
        data: {
          node,
          selected: node.id === selectedId,
          moreLabel: node.kind === 'more' ? labels.more(node.objectType) : '',
        },
        draggable: false,
        connectable: false,
        ariaLabel:
          'entity' in node
            ? node.entity.label
            : node.kind === 'cluster'
              ? node.objectType
              : labels.more(node.objectType),
      })),
    [nodes, selectedId, labels],
  );
  const flowEdges: Edge[] = useMemo(
    () =>
      edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'straight',
        style: edgeStyle[edge.kind],
        focusable: false,
        ...(edge.label
          ? {
              label: edge.label,
              labelStyle: {
                fill: 'var(--ds-fg-2)',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
              },
              labelBgStyle: { fill: 'var(--ds-bg)' },
              labelBgPadding: [4, 2] as [number, number],
              labelBgBorderRadius: 3,
            }
          : {}),
      })),
    [edges],
  );

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const clicks = useClickOrDoubleClick(onSelect, onRecenter);

  return (
    <ReactFlow
      nodes={flowNodes}
      edges={flowEdges}
      nodeTypes={nodeTypes}
      nodeOrigin={[0.5, 0.5]}
      fitView
      fitViewOptions={{ padding: 0.15 }}
      minZoom={0.2}
      maxZoom={2.5}
      zoomOnDoubleClick={false}
      nodesDraggable={false}
      nodesConnectable={false}
      proOptions={{ hideAttribution: true }}
      onNodeClick={(_, flowNode) => {
        const node = byId.get(flowNode.id);
        if (!node) return;
        if (node.kind === 'cluster') onToggleCluster(node.objectType);
        else if (node.kind === 'more') onMore(node.objectType);
        else if (!node.entity.missing) clicks.click(node.entity.uuid, node.kind !== 'center');
      }}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--ds-dot)" />
      <FitOnChange signature={nodes.map((n) => n.id).join('|')} />
    </ReactFlow>
  );
}
