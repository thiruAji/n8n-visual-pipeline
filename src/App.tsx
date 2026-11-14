import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  ReactFlowProvider,
  useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Play,
  RotateCcw,
  Search,
  Sparkles,
  Download,
  Upload,
  Layers,
  Terminal,
  ChevronUp,
  ChevronDown,
  StepForward,
  CheckCircle2,
  AlertCircle,
  Workflow,
  Plus,
  Trash2
} from 'lucide-react';

import {
  DataItem,
  ExecutionLogEntry,
  ExecutionStatus,
  NodeCategory,
  NodeConfig,
  NodeTypeKey,
  WorkflowEdge,
  WorkflowNode
} from './types/workflow';
import {
  CATEGORY_META,
  getCatalogItem,
  NODE_CATALOG,
  NodeCatalogItem
} from './data/nodeCatalog';
import { WORKFLOW_TEMPLATES } from './data/templates';
import { CanvasNode } from './components/CanvasNode';
import { AnimatedEdge } from './components/AnimatedEdge';
import { NodeIcon } from './components/NodeIcon';
import { NodeInspectorModal } from './components/NodeInspectorModal';
import {
  executeSingleNodeLogic,
  executeWorkflowGraph
} from './engine/workflowRunner';

const nodeTypes = {
  pipelineNode: CanvasNode
};

const edgeTypes = {
  animatedEdge: AnimatedEdge
};

const PipelineEditor: React.FC = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView } = useReactFlow();

  const initialTemplate = WORKFLOW_TEMPLATES[0];
  const [workflowName, setWorkflowName] = useState<string>(initialTemplate.name);
  const [activeTemplateId, setActiveTemplateId] = useState<string>(
    initialTemplate.id
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNode>(
    initialTemplate.nodes
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<WorkflowEdge>(
    initialTemplate.edges
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [inspectingNodeId, setInspectingNodeId] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [stepMode, setStepMode] = useState<'auto' | 'fast' | 'manualStep'>('auto');
  const [waitingNextStepNode, setWaitingNextStepNode] = useState<string | null>(
    null
  );
  const nextStepResolverRef = useRef<(() => void) | null>(null);
  const stopExecutionRef = useRef(false);

  const [executionLogs, setExecutionLogs] = useState<ExecutionLogEntry[]>([]);
  const [isLogDrawerOpen, setIsLogDrawerOpen] = useState(true);

  // Quick-add connection state when clicking '+' on a node output handle
  const [pendingQuickAdd, setPendingQuickAdd] = useState<{
    sourceNodeId: string;
    sourceHandle?: string | null;
  } | null>(null);

  // Delete an edge by ID
  const handleDeleteEdge = useCallback(
    (edgeId: string) => {
      setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    },
    [setEdges]
  );

  // Delete a node by ID
  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) =>
        eds.filter((e) => e.source !== nodeId && e.target !== nodeId)
      );
      if (inspectingNodeId === nodeId) {
        setInspectingNodeId(null);
      }
    },
    [setNodes, setEdges, inspectingNodeId]
  );

  // Duplicate a node
  const handleDuplicateNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => {
        const target = nds.find((n) => n.id === nodeId);
        if (!target) return nds;
        const newId = `node-${Date.now()}`;
        const copy: WorkflowNode = {
          ...target,
          id: newId,
          selected: false,
          position: {
            x: target.position.x + 60,
            y: target.position.y + 60
          },
          data: {
            ...target.data,
            label: `${target.data.label} (Copy)`,
            status: 'idle',
            inputData: [],
            outputData: [],
            config: JSON.parse(JSON.stringify(target.data.config))
          }
        };
        return [...nds, copy];
      });
    },
    [setNodes]
  );

  // Gather upstream items for single-node test execution
  const getUpstreamInputForNode = useCallback(
    (targetNodeId: string, currentNodes: WorkflowNode[], currentEdges: WorkflowEdge[]): DataItem[] => {
      const incomingEdges = currentEdges.filter((e) => e.target === targetNodeId);
      if (incomingEdges.length === 0) return [];

      const collected: DataItem[] = [];
      for (const edge of incomingEdges) {
        const sourceNode = currentNodes.find((n) => n.id === edge.source);
        if (!sourceNode) continue;

        if (sourceNode.data.typeKey === 'ifCondition') {
          if (edge.sourceHandle === 'true' || edge.data?.branchLabel === 'true') {
            collected.push(...(sourceNode.data.trueOutputData || []));
          } else if (
            edge.sourceHandle === 'false' ||
            edge.data?.branchLabel === 'false'
          ) {
            collected.push(...(sourceNode.data.falseOutputData || []));
          } else {
            collected.push(...(sourceNode.data.outputData || []));
          }
        } else if (sourceNode.data.outputData?.length) {
          collected.push(...sourceNode.data.outputData);
        } else if (sourceNode.data.config.samplePayload) {
          try {
            const parsed = JSON.parse(sourceNode.data.config.samplePayload);
            collected.push(...(Array.isArray(parsed) ? parsed : [parsed]));
          } catch {
            // ignore
          }
        }
      }
      return collected;
    },
    []
  );

  // Execute a single node immediately
  const handleRunSingleNode = useCallback(
    async (nodeId: string) => {
      const targetNode = nodes.find((n) => n.id === nodeId);
      if (!targetNode) return;

      const inputItems = getUpstreamInputForNode(nodeId, nodes, edges);

      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  status: 'running',
                  inputData: inputItems,
                  errorMessage: undefined
                }
              }
            : n
        )
      );

      try {
        const res = await executeSingleNodeLogic(targetNode, inputItems, 300);
        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    status: 'success',
                    inputData: inputItems,
                    outputData: res.outputData,
                    trueOutputData: res.trueOutputData,
                    falseOutputData: res.falseOutputData,
                    executionTimeMs: res.durationMs
                  }
                }
              : n
          )
        );

        setExecutionLogs((prev) => [
          {
            id: `${nodeId}-${Date.now()}`,
            nodeId,
            nodeLabel: targetNode.data.label,
            typeKey: targetNode.data.typeKey,
            status: 'success',
            timestamp: new Date().toLocaleTimeString(),
            durationMs: res.durationMs,
            inputCount: inputItems.length,
            outputCount: res.outputData.length,
            inputPreview: inputItems,
            outputPreview: res.outputData
          },
          ...prev
        ]);
      } catch (err: any) {
        const msg = err?.message || 'Node execution failed';
        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    status: 'error',
                    inputData: inputItems,
                    errorMessage: msg
                  }
                }
              : n
          )
        );
      }
    },
    [nodes, edges, getUpstreamInputForNode, setNodes]
  );

  // Inject action callbacks into nodes and edges
  const enrichedNodes = useMemo(() => {
    return nodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        onQuickRun: handleRunSingleNode,
        onOpenInspector: (id: string) => setInspectingNodeId(id),
        onDeleteNode: handleDeleteNode,
        onDuplicateNode: handleDuplicateNode,
        onQuickAddFromHandle: (sourceNodeId: string, sourceHandle?: string | null) => {
          setPendingQuickAdd({ sourceNodeId, sourceHandle });
        }
      }
    }));
  }, [nodes, handleRunSingleNode, handleDeleteNode, handleDuplicateNode]);

  const enrichedEdges = useMemo(() => {
    return edges.map((e) => ({
      ...e,
      type: 'animatedEdge',
      data: {
        ...e.data,
        onDeleteEdge: handleDeleteEdge
      }
    }));
  }, [edges, handleDeleteEdge]);

  // Connect two handles on the canvas
  const onConnect = useCallback(
    (connection: Connection) => {
      const branchLabel =
        connection.sourceHandle === 'true'
          ? 'true'
          : connection.sourceHandle === 'false'
          ? 'false'
          : undefined;

      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            id: `e-${connection.source}-${connection.sourceHandle || 'out'}-${
              connection.target
            }-${Date.now()}`,
            type: 'animatedEdge',
            data: { branchLabel }
          },
          eds
        )
      );
    },
    [setEdges]
  );

  // Add a node from the catalog (either via click or drag-and-drop)
  const addNodeFromCatalog = useCallback(
    (item: NodeCatalogItem, position?: { x: number; y: number }) => {
      const newNodeId = `node-${Date.now()}`;
      let targetPos = position;

      if (!targetPos) {
        if (pendingQuickAdd) {
          const srcNode = nodes.find((n) => n.id === pendingQuickAdd.sourceNodeId);
          targetPos = srcNode
            ? {
                x: srcNode.position.x + 320,
                y:
                  pendingQuickAdd.sourceHandle === 'true'
                    ? srcNode.position.y - 90
                    : pendingQuickAdd.sourceHandle === 'false'
                    ? srcNode.position.y + 110
                    : srcNode.position.y
              }
            : { x: 420, y: 220 };
        } else {
          const offset = (nodes.length % 5) * 35;
          targetPos = { x: 280 + offset, y: 160 + offset };
        }
      }

      const newNode: WorkflowNode = {
        id: newNodeId,
        type: 'pipelineNode',
        position: targetPos,
        data: {
          label: item.label,
          subtitle: item.subtitle,
          typeKey: item.typeKey,
          category: item.category,
          config: JSON.parse(JSON.stringify(item.defaultConfig)),
          status: 'idle',
          inputData: [],
          outputData: []
        }
      };

      setNodes((nds) => [...nds, newNode]);

      if (pendingQuickAdd) {
        const branchLabel =
          pendingQuickAdd.sourceHandle === 'true'
            ? 'true'
            : pendingQuickAdd.sourceHandle === 'false'
            ? 'false'
            : undefined;

        setEdges((eds) => [
          ...eds,
          {
            id: `e-${pendingQuickAdd.sourceNodeId}-${newNodeId}`,
            source: pendingQuickAdd.sourceNodeId,
            sourceHandle: pendingQuickAdd.sourceHandle || undefined,
            target: newNodeId,
            type: 'animatedEdge',
            data: { branchLabel }
          }
        ]);
        setPendingQuickAdd(null);
      }
    },
    [nodes, pendingQuickAdd, setNodes, setEdges]
  );

  // Drag-and-drop handlers
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const typeKey = event.dataTransfer.getData(
        'application/reactflow-nodetype'
      ) as NodeTypeKey;
      if (!typeKey) return;

      const catalogItem = getCatalogItem(typeKey);
      const position = screenToFlowPosition({
        x: event.clientX - 110,
        y: event.clientY - 35
      });

      addNodeFromCatalog(catalogItem, position);
    },
    [screenToFlowPosition, addNodeFromCatalog]
  );

  // Reset execution statuses
  const resetExecutionState = useCallback(() => {
    stopExecutionRef.current = true;
    if (nextStepResolverRef.current) {
      nextStepResolverRef.current();
      nextStepResolverRef.current = null;
    }
    setWaitingNextStepNode(null);
    setIsExecuting(false);

    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          status: 'idle',
          executionTimeMs: undefined,
          errorMessage: undefined,
          inputData: [],
          outputData: [],
          trueOutputData: undefined,
          falseOutputData: undefined
        }
      }))
    );

    setEdges((eds) =>
      eds.map((e) => ({
        ...e,
        data: {
          ...e.data,
          isExecuting: false,
          isExecuted: false,
          itemCount: undefined
        }
      }))
    );
  }, [setNodes, setEdges]);

  // Execute the full workflow graph
  const handleExecuteWorkflow = useCallback(async () => {
    if (isExecuting) return;

    stopExecutionRef.current = false;
    setIsExecuting(true);
    setIsLogDrawerOpen(true);
    setExecutionLogs([]);

    // Clear previous run state
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          status: 'idle',
          executionTimeMs: undefined,
          errorMessage: undefined,
          inputData: [],
          outputData: [],
          trueOutputData: undefined,
          falseOutputData: undefined
        }
      }))
    );
    setEdges((eds) =>
      eds.map((e) => ({
        ...e,
        data: {
          ...e.data,
          isExecuting: false,
          isExecuted: false,
          itemCount: undefined
        }
      }))
    );

    const delayMs = stepMode === 'fast' ? 140 : 480;

    await executeWorkflowGraph(
      nodes,
      edges,
      {
        shouldStop: () => stopExecutionRef.current,
        waitForNextStepIfPaused:
          stepMode === 'manualStep'
            ? async (nodeLabel: string) => {
                setWaitingNextStepNode(nodeLabel);
                await new Promise<void>((resolve) => {
                  nextStepResolverRef.current = resolve;
                });
                setWaitingNextStepNode(null);
              }
            : undefined,
        onNodeStatusChange: (
          nodeId: string,
          status: ExecutionStatus,
          patch?: Partial<WorkflowNode['data']>
        ) => {
          setNodes((nds) =>
            nds.map((n) =>
              n.id === nodeId
                ? {
                    ...n,
                    data: {
                      ...n.data,
                      ...patch,
                      status
                    }
                  }
                : n
            )
          );
        },
        onEdgeStatusChange: (edgeId, patch) => {
          setEdges((eds) =>
            eds.map((e) =>
              e.id === edgeId
                ? {
                    ...e,
                    data: {
                      ...e.data,
                      ...patch
                    }
                  }
                : e
            )
          );
        },
        onLogEntry: (entry) => {
          setExecutionLogs((prev) => [...prev, entry]);
        }
      },
      delayMs
    );

    setIsExecuting(false);
    setWaitingNextStepNode(null);
  }, [isExecuting, nodes, edges, stepMode, setNodes, setEdges]);

  // Advance 1 step when in manual step-by-step mode
  const handleAdvanceManualStep = () => {
    if (nextStepResolverRef.current) {
      const resolve = nextStepResolverRef.current;
      nextStepResolverRef.current = null;
      resolve();
    }
  };

  // Update node configuration from Inspector Modal
  const handleUpdateNode = useCallback(
    (
      nodeId: string,
      updates: { label?: string; subtitle?: string; config?: NodeConfig }
    ) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  ...(updates.label !== undefined ? { label: updates.label } : {}),
                  ...(updates.subtitle !== undefined
                    ? { subtitle: updates.subtitle }
                    : {}),
                  ...(updates.config !== undefined ? { config: updates.config } : {})
                }
              }
            : n
        )
      );
    },
    [setNodes]
  );

  // Switch pre-built workflow template
  const handleSelectTemplate = (templateId: string) => {
    const tpl = WORKFLOW_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    resetExecutionState();
    setActiveTemplateId(tpl.id);
    setWorkflowName(tpl.name);
    setNodes(JSON.parse(JSON.stringify(tpl.nodes)));
    setEdges(JSON.parse(JSON.stringify(tpl.edges)));
    setExecutionLogs([]);
    setTimeout(() => fitView({ padding: 0.18, duration: 350 }), 60);
  };

  // Export workflow JSON
  const handleExportWorkflow = () => {
    const payload = {
      name: workflowName,
      exportedAt: new Date().toISOString(),
      nodes,
      edges
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workflowName.toLowerCase().replace(/\s+/g, '-')}.n8n.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import workflow JSON
  const handleImportWorkflow = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result));
        if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
          resetExecutionState();
          setWorkflowName(parsed.name || 'Imported Pipeline');
          setNodes(parsed.nodes);
          setEdges(parsed.edges);
          setTimeout(() => fitView({ padding: 0.18, duration: 350 }), 60);
        }
      } catch {
        alert('Invalid workflow JSON file.');
      }
    };
    reader.readAsText(file);
  };

  // Fit view on initial mount
  useEffect(() => {
    const t = setTimeout(() => fitView({ padding: 0.18 }), 100);
    return () => clearTimeout(t);
  }, [fitView]);

  const inspectingNode = useMemo(
    () => nodes.find((n) => n.id === inspectingNodeId) || null,
    [nodes, inspectingNodeId]
  );

  const groupedCatalog = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const filtered = NODE_CATALOG.filter(
      (item) =>
        !q ||
        item.label.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
    );
    const groups: Record<NodeCategory, NodeCatalogItem[]> = {
      trigger: [],
      action: [],
      logic: [],
      code: [],
      ai: []
    };
    filtered.forEach((item) => groups[item.category].push(item));
    return groups;
  }, [searchQuery]);

  return (
    <div className="n8n-app-shell">
      {/* TOP NAVIGATION & EXECUTION HEADER */}
      <header className="n8n-topbar">
        <div className="topbar-left">
          <div className="n8n-brand-badge">
            <Workflow size={18} color="#fff" />
            <span>n8n FlowStudio</span>
          </div>

          <input
            type="text"
            className="workflow-name-input"
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            aria-label="Workflow Name"
          />

          <div className="template-switcher">
            <Layers size={14} />
            <select
              value={activeTemplateId}
              onChange={(e) => handleSelectTemplate(e.target.value)}
              title="Load Starter Pipeline Template"
            >
              {WORKFLOW_TEMPLATES.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  Template: {tpl.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="topbar-right">
          {/* Execution Mode Selector */}
          <div className="step-mode-control">
            <span>Mode:</span>
            <select
              value={stepMode}
              onChange={(e) => setStepMode(e.target.value as any)}
              disabled={isExecuting}
            >
              <option value="auto">Live Step-by-Step (480ms)</option>
              <option value="fast">Fast Execution (140ms)</option>
              <option value="manualStep">Interactive Debugger (Pause each node)</option>
            </select>
          </div>

          {waitingNextStepNode && (
            <button
              type="button"
              className="n8n-btn-step-next"
              onClick={handleAdvanceManualStep}
            >
              <StepForward size={15} /> Next Step ({waitingNextStepNode})
            </button>
          )}

          <button
            type="button"
            className={`n8n-btn-execute ${isExecuting ? 'is-running' : ''}`}
            onClick={handleExecuteWorkflow}
            disabled={isExecuting && !waitingNextStepNode}
          >
            <Play size={15} fill="currentColor" />
            {isExecuting ? 'Running Pipeline...' : 'Execute Workflow'}
          </button>

          <button
            type="button"
            className="n8n-btn-secondary"
            onClick={resetExecutionState}
            title="Reset node statuses & clear run state"
          >
            <RotateCcw size={14} /> Reset
          </button>

          <button
            type="button"
            className="n8n-btn-secondary"
            onClick={handleExportWorkflow}
            title="Export Workflow JSON"
          >
            <Download size={14} /> Export
          </button>

          <label className="n8n-btn-secondary import-label" title="Import Workflow JSON">
            <Upload size={14} /> Import
            <input
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleImportWorkflow}
            />
          </label>
        </div>
      </header>

      {/* MAIN WORKSPACE BODY */}
      <div className="n8n-workspace-body">
        {/* LEFT NODE PALETTE SIDEBAR */}
        <aside className="n8n-sidebar">
          <div className="sidebar-header">
            <div className="sidebar-title-row">
              <h3>Node Library</h3>
              <span className="node-count-chip">{NODE_CATALOG.length} nodes</span>
            </div>
            <p className="sidebar-subtitle">
              Drag onto canvas or click to insert
            </p>

            {pendingQuickAdd && (
              <div className="quick-add-banner">
                <span>
                  Connecting from <strong>{pendingQuickAdd.sourceNodeId}</strong>
                  {pendingQuickAdd.sourceHandle
                    ? ` (${pendingQuickAdd.sourceHandle})`
                    : ''}
                </span>
                <button
                  type="button"
                  onClick={() => setPendingQuickAdd(null)}
                >
                  Cancel
                </button>
              </div>
            )}

            <div className="sidebar-search">
              <Search size={14} />
              <input
                type="text"
                placeholder="Search nodes (HTTP, IF, Code, AI...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="sidebar-catalog-scroll">
            {(Object.keys(CATEGORY_META) as NodeCategory[]).map((catKey) => {
              const items = groupedCatalog[catKey];
              if (!items || items.length === 0) return null;
              const meta = CATEGORY_META[catKey];

              return (
                <div key={catKey} className="catalog-section">
                  <div className="catalog-section-header">
                    <span
                      className="cat-dot"
                      style={{ background: meta.color }}
                    />
                    <span>{meta.title}</span>
                  </div>

                  <div className="catalog-items-list">
                    {items.map((item) => (
                      <div
                        key={item.typeKey}
                        className="catalog-node-item"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData(
                            'application/reactflow-nodetype',
                            item.typeKey
                          );
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onClick={() => addNodeFromCatalog(item)}
                      >
                        <div
                          className="catalog-node-icon"
                          style={{
                            background: item.bgGlow,
                            borderColor: `${item.color}44`
                          }}
                        >
                          <NodeIcon
                            typeKey={item.typeKey}
                            size={17}
                            color={item.color}
                          />
                        </div>
                        <div className="catalog-node-meta">
                          <div className="catalog-node-name">{item.label}</div>
                          <div className="catalog-node-desc">
                            {item.subtitle}
                          </div>
                        </div>
                        <Plus size={14} className="catalog-add-icon" />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* CENTER REACT FLOW CANVAS + BOTTOM EXECUTION DRAWER */}
        <main className="n8n-canvas-area" ref={reactFlowWrapper}>
          <div className="canvas-floating-hint">
            <span>
              <strong>Tip:</strong> Double-click any node (or click{' '}
              <code>Inspect →</code>) to view live <strong>Input / Output</strong>{' '}
              tables & edit parameters.
            </span>
          </div>

          <ReactFlow
            nodes={enrichedNodes}
            edges={enrichedEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            deleteKeyCode={['Backspace', 'Delete']}
            defaultEdgeOptions={{
              type: 'animatedEdge'
            }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={22}
              size={1.4}
              color="#334155"
            />
            <Controls className="n8n-flow-controls" />
            <MiniMap
              className="n8n-minimap"
              pannable
              zoomable
              nodeColor={(n) => {
                const d = n.data as WorkflowNode['data'];
                if (d?.status === 'running') return '#ff6d5a';
                if (d?.status === 'success') return '#10b981';
                if (d?.status === 'error') return '#ef4444';
                return getCatalogItem(d?.typeKey || 'manualTrigger').color;
              }}
            />
          </ReactFlow>

          {/* BOTTOM LIVE EXECUTION LOG & DATA INSPECTOR DRAWER */}
          <div
            className={`n8n-log-drawer ${
              isLogDrawerOpen ? 'is-open' : 'is-collapsed'
            }`}
          >
            <div
              className="log-drawer-header"
              onClick={() => setIsLogDrawerOpen((o) => !o)}
            >
              <div className="log-header-left">
                <Terminal size={15} color="#ff6d5a" />
                <span>Live Execution Data & Step Timeline</span>
                <span className="log-count-pill">
                  {executionLogs.length}{' '}
                  {executionLogs.length === 1 ? 'step' : 'steps'} executed
                </span>
              </div>

              <div className="log-header-right">
                {executionLogs.length > 0 && (
                  <button
                    type="button"
                    className="clear-logs-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExecutionLogs([]);
                    }}
                  >
                    <Trash2 size={12} /> Clear Logs
                  </button>
                )}
                {isLogDrawerOpen ? (
                  <ChevronDown size={16} />
                ) : (
                  <ChevronUp size={16} />
                )}
              </div>
            </div>

            {isLogDrawerOpen && (
              <div className="log-drawer-body">
                {executionLogs.length === 0 ? (
                  <div className="log-empty-banner">
                    Click <strong>"Execute Workflow"</strong> in the top bar to
                    watch data flow step-by-step across your pipeline nodes.
                  </div>
                ) : (
                  <div className="log-steps-list">
                    {executionLogs.map((entry, idx) => (
                      <div
                        key={entry.id}
                        className={`log-step-row status-${entry.status}`}
                        onClick={() => setInspectingNodeId(entry.nodeId)}
                      >
                        <span className="log-step-index">#{idx + 1}</span>
                        <span className="log-step-status">
                          {entry.status === 'success' ? (
                            <CheckCircle2 size={14} color="#10b981" />
                          ) : (
                            <AlertCircle size={14} color="#ef4444" />
                          )}
                        </span>
                        <strong className="log-node-name">
                          {entry.nodeLabel}
                        </strong>
                        <span className="log-io-pill">
                          {entry.inputCount} in → {entry.outputCount} out
                        </span>
                        {entry.branchInfo && (
                          <span className="log-branch-pill">
                            {entry.branchInfo}
                          </span>
                        )}
                        <span className="log-duration">{entry.durationMs}ms</span>
                        <span className="log-timestamp">{entry.timestamp}</span>
                        <span className="log-inspect-cta">
                          Inspect I/O Data →
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* 3-PANE n8n NODE INSPECTOR MODAL */}
      {inspectingNode && (
        <NodeInspectorModal
          node={inspectingNode}
          onClose={() => setInspectingNodeId(null)}
          onUpdateNode={handleUpdateNode}
          onTestSingleNode={handleRunSingleNode}
        />
      )}
    </div>
  );
};

export default function App() {
  return (
    <ReactFlowProvider>
      <PipelineEditor />
    </ReactFlowProvider>
  );
}
