import { useState, useCallback, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Play, Save, FolderOpen, RotateCcw, Film, ScanSearch,
  Package, FileText, ImageIcon, Video, Layers, MonitorPlay,
} from 'lucide-react';
import {
  VideoInputNode, AnalyzeNode, AssetsInputNode, ScriptNode,
  RefImageNode, VeoNode, ConcatNode, OutputNode,
} from './nodes/index.js';
import { runFlow } from './flowRunner.js';

const nodeTypes = {
  VideoInputNode,
  AnalyzeNode,
  AssetsInputNode,
  ScriptNode,
  RefImageNode,
  VeoNode,
  ConcatNode,
  OutputNode,
};

const PALETTE_ITEMS = [
  { type: 'VideoInputNode', label: 'Video Input', icon: Film, color: 'text-pink-500' },
  { type: 'AnalyzeNode', label: 'Analyze Video', icon: ScanSearch, color: 'text-violet-500' },
  { type: 'AssetsInputNode', label: 'Assets Input', icon: Package, color: 'text-amber-500' },
  { type: 'ScriptNode', label: 'Generate Script', icon: FileText, color: 'text-blue-500' },
  { type: 'RefImageNode', label: 'Ref Images', icon: ImageIcon, color: 'text-green-500' },
  { type: 'VeoNode', label: 'Generate Clips', icon: Video, color: 'text-orange-500' },
  { type: 'ConcatNode', label: 'Concat Video', icon: Layers, color: 'text-cyan-500' },
  { type: 'OutputNode', label: 'Output', icon: MonitorPlay, color: 'text-pink-500' },
];

const DEFAULT_PRESET_NODES = [
  { id: '1', type: 'VideoInputNode', position: { x: 40, y: 80 }, data: {} },
  { id: '2', type: 'AnalyzeNode', position: { x: 320, y: 80 }, data: {} },
  { id: '3', type: 'AssetsInputNode', position: { x: 40, y: 280 }, data: { duration: 24 } },
  { id: '4', type: 'ScriptNode', position: { x: 600, y: 160 }, data: {} },
  { id: '5', type: 'RefImageNode', position: { x: 880, y: 160 }, data: {} },
  { id: '6', type: 'VeoNode', position: { x: 1160, y: 160 }, data: {} },
  { id: '7', type: 'ConcatNode', position: { x: 1440, y: 80 }, data: {} },
  { id: '8', type: 'OutputNode', position: { x: 1440, y: 280 }, data: {} },
];

const DEFAULT_PRESET_EDGES = [
  { id: 'e1-2', source: '1', sourceHandle: 'video', target: '2', targetHandle: 'video' },
  { id: 'e2-4t', source: '2', sourceHandle: 'template', target: '4', targetHandle: 'template' },
  { id: 'e3-4i', source: '3', sourceHandle: 'images', target: '4', targetHandle: 'images' },
  { id: 'e3-4c', source: '3', sourceHandle: 'characters', target: '4', targetHandle: 'characters' },
  { id: 'e3-4d', source: '3', sourceHandle: 'duration', target: '4', targetHandle: 'duration' },
  { id: 'e4-5s', source: '4', sourceHandle: 'scenes', target: '5', targetHandle: 'scenes' },
  { id: 'e3-5i', source: '3', sourceHandle: 'images', target: '5', targetHandle: 'images' },
  { id: 'e3-5c', source: '3', sourceHandle: 'characters', target: '5', targetHandle: 'characters' },
  { id: 'e4-6s', source: '4', sourceHandle: 'scenes', target: '6', targetHandle: 'scenes' },
  { id: 'e5-6r', source: '5', sourceHandle: 'refImages', target: '6', targetHandle: 'refImages' },
  { id: 'e6-7', source: '6', sourceHandle: 'clips', target: '7', targetHandle: 'clips' },
  { id: 'e7-8', source: '7', sourceHandle: 'finalVideo', target: '8', targetHandle: 'finalVideo' },
  { id: 'e6-8', source: '6', sourceHandle: 'clips', target: '8', targetHandle: 'clips' },
];

function loadSavedGraph() {
  try {
    const raw = localStorage.getItem('video_flow_current');
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function loadPresets() {
  try {
    const raw = localStorage.getItem('video_flows');
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

let nodeIdCounter = 100;
function newNodeId() { return `n${++nodeIdCounter}`; }

export default function FlowEditor({ credentials, language = 'Tiếng Việt' }) {
  const saved = loadSavedGraph();
  const [nodes, setNodes] = useState(
    (saved?.nodes ?? DEFAULT_PRESET_NODES).map((n) => ({ ...n, data: { ...n.data } }))
  );
  const [edges, setEdges] = useState(saved?.edges ?? DEFAULT_PRESET_EDGES);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState(null);
  const [presets, setPresets] = useState(loadPresets);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [presetName, setPresetName] = useState('');
  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);

  const onNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );
  const onConnect = useCallback(
    (connection) => setEdges((eds) => addEdge({ ...connection, animated: true }, eds)),
    []
  );

  const persistGraph = useCallback((nds, eds) => {
    localStorage.setItem('video_flow_current', JSON.stringify({ nodes: nds, edges: eds }));
  }, []);

  const updateNodeData = useCallback((nodeId, patch) => {
    setNodes((nds) => {
      const updated = nds.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n
      );
      persistGraph(updated, edges);
      return updated;
    });
  }, [edges, persistGraph]);

  const nodesWithCallbacks = nodes.map((n) => ({
    ...n,
    data: {
      ...n.data,
      onDataChange: (patch) => updateNodeData(n.id, patch),
    },
  }));

  const onDragStart = useCallback((e, type) => {
    e.dataTransfer.setData('application/reactflow', type);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/reactflow');
    if (!type || !reactFlowInstance) return;

    const bounds = reactFlowWrapper.current.getBoundingClientRect();
    const position = reactFlowInstance.screenToFlowPosition({
      x: e.clientX - bounds.left,
      y: e.clientY - bounds.top,
    });

    const newNode = {
      id: newNodeId(),
      type,
      position,
      data: {},
    };
    setNodes((nds) => [...nds, newNode]);
  }, [reactFlowInstance]);

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onNodeClick = useCallback((_, node) => {
    setSelectedNodeId(node.id);
  }, []);

  const handleReset = useCallback(() => {
    setNodes(DEFAULT_PRESET_NODES.map((n) => ({ ...n, data: { ...n.data } })));
    setEdges(DEFAULT_PRESET_EDGES);
    setSelectedNodeId(null);
    localStorage.removeItem('video_flow_current');
  }, []);

  const handleSavePreset = useCallback(() => {
    if (!presetName.trim()) return;
    const updated = { ...presets, [presetName.trim()]: { nodes, edges } };
    setPresets(updated);
    localStorage.setItem('video_flows', JSON.stringify(updated));
    setShowSaveDialog(false);
    setPresetName('');
  }, [presetName, presets, nodes, edges]);

  const handleLoadPreset = useCallback((name) => {
    const preset = presets[name];
    if (!preset) return;
    setNodes(preset.nodes.map((n) => ({ ...n, data: { ...n.data } })));
    setEdges(preset.edges);
    setShowLoadDialog(false);
    persistGraph(preset.nodes, preset.edges);
  }, [presets, persistGraph]);

  const handleRun = useCallback(async () => {
    setRunning(true);
    setRunError(null);

    const clearStatus = () =>
      setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, status: 'idle', progress: undefined } })));
    clearStatus();

    try {
      await runFlow({
        nodes,
        edges,
        credentials: { ...credentials, language },
        onNodeStatus: (nodeId, status, extra) => {
          setNodes((nds) =>
            nds.map((n) =>
              n.id === nodeId
                ? { ...n, data: { ...n.data, status, ...extra } }
                : n
            )
          );
        },
        onNodeData: (nodeId, output) => {
          setNodes((nds) =>
            nds.map((n) =>
              n.id === nodeId ? { ...n, data: { ...n.data, ...output } } : n
            )
          );
        },
      });
    } catch (err) {
      setRunError(err.message);
    } finally {
      setRunning(false);
    }
  }, [nodes, edges, credentials]);

  const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null;

  return (
    <div className="flex h-full min-h-0 bg-background" style={{ height: '100%' }}>
      {/* Left palette */}
      <div className="w-44 flex-shrink-0 border-r border-border bg-muted/10 p-2 flex flex-col gap-1 overflow-y-auto">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 px-1">Nodes</p>
        {PALETTE_ITEMS.map(({ type, label, icon: Icon, color }) => (
          <div
            key={type}
            draggable
            onDragStart={(e) => onDragStart(e, type)}
            className="flex items-center gap-2 px-2 py-2 rounded-lg border border-border bg-background cursor-grab hover:border-pink-400 hover:bg-pink-500/5 transition-colors select-none"
          >
            <Icon size={13} className={color} />
            <span className="text-[11px] font-medium text-foreground">{label}</span>
          </div>
        ))}
      </div>

      {/* Center canvas */}
      <div className="flex-1 relative min-w-0" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodesWithCallbacks}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onInit={setReactFlowInstance}
          onNodeClick={onNodeClick}
          onPaneClick={() => setSelectedNodeId(null)}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          deleteKeyCode="Delete"
        >
          <Background variant="dots" gap={16} size={1} className="opacity-30" />
          <Controls />
          <MiniMap nodeColor={() => '#ec4899'} maskColor="rgba(0,0,0,0.1)" />

          {/* Toolbar */}
          <Panel position="top-center">
            <div className="flex items-center gap-2 bg-card/95 backdrop-blur-md border border-border rounded-xl px-3 py-1.5 shadow-xl ring-1 ring-black/5">
              <button
                onClick={() => setShowSaveDialog(true)}
                disabled={running}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold text-foreground rounded-lg border border-border bg-background hover:bg-muted hover:border-pink-500/40 transition-colors disabled:opacity-40"
              >
                <Save size={12} /> Save preset
              </button>
              <button
                onClick={() => setShowLoadDialog(true)}
                disabled={running}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold text-foreground rounded-lg border border-border bg-background hover:bg-muted hover:border-pink-500/40 transition-colors disabled:opacity-40"
              >
                <FolderOpen size={12} /> Load preset
              </button>
              <button
                onClick={handleReset}
                disabled={running}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold text-foreground rounded-lg border border-border bg-background hover:bg-muted hover:border-pink-500/40 transition-colors disabled:opacity-40"
              >
                <RotateCcw size={12} /> Reset
              </button>
              <div className="w-px h-5 bg-border mx-1" />
              <button
                onClick={handleRun}
                disabled={running}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-bold bg-pink-500 hover:bg-pink-600 text-white rounded-lg shadow-md shadow-pink-500/30 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Play size={12} /> {running ? 'Running…' : 'Run'}
              </button>
            </div>
          </Panel>

          {runError && (
            <Panel position="bottom-center">
              <div className="bg-red-500/10 border border-red-500/30 text-red-600 text-[11px] rounded-xl px-4 py-2 max-w-md">
                {runError}
              </div>
            </Panel>
          )}
        </ReactFlow>
      </div>

      {/* Right inspector */}
      <div className="w-52 flex-shrink-0 border-l border-border bg-muted/10 p-3 overflow-y-auto">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Inspector</p>
        {selectedNode ? (
          <div className="space-y-2">
            <div className="text-xs font-bold text-foreground">{selectedNode.type}</div>
            <div className="text-[11px] text-muted-foreground">ID: {selectedNode.id}</div>
            <div className="text-[11px]">
              Status:{' '}
              <span className={
                selectedNode.data.status === 'done' ? 'text-green-600 font-bold' :
                selectedNode.data.status === 'running' ? 'text-blue-500 font-bold' :
                selectedNode.data.status === 'error' ? 'text-red-500 font-bold' :
                'text-muted-foreground'
              }>
                {selectedNode.data.status || 'idle'}
              </span>
            </div>
            {selectedNode.data.error && (
              <div className="text-[11px] text-red-500 bg-red-500/10 rounded p-1.5">
                {selectedNode.data.error}
              </div>
            )}
            {selectedNode.data.progress && (
              <div className="text-[11px] text-blue-500">
                {selectedNode.data.progress.done}/{selectedNode.data.progress.total}
              </div>
            )}
            <div className="text-[10px] text-muted-foreground mt-2">
              Position: ({Math.round(selectedNode.position.x)}, {Math.round(selectedNode.position.y)})
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">Click a node to inspect</p>
        )}
      </div>

      {/* Save preset dialog */}
      {showSaveDialog && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-background border border-border rounded-xl p-5 shadow-xl w-72">
            <p className="text-sm font-bold mb-3">Save Flow Preset</p>
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Preset name..."
              className="w-full px-3 py-2 text-xs bg-muted border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-pink-500 mb-3"
              onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowSaveDialog(false)}
                className="px-3 py-1.5 text-xs rounded-lg hover:bg-muted transition-colors">Cancel</button>
              <button onClick={handleSavePreset}
                className="px-3 py-1.5 text-xs font-bold bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load preset dialog */}
      {showLoadDialog && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-background border border-border rounded-xl p-5 shadow-xl w-72">
            <p className="text-sm font-bold mb-3">Load Flow Preset</p>
            {Object.keys(presets).length === 0 ? (
              <p className="text-xs text-muted-foreground mb-3">No presets saved yet.</p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto mb-3">
                {Object.keys(presets).map((name) => (
                  <button
                    key={name}
                    onClick={() => handleLoadPreset(name)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted rounded-lg transition-colors"
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <button onClick={() => setShowLoadDialog(false)}
                className="px-3 py-1.5 text-xs rounded-lg hover:bg-muted transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
