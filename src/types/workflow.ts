import { Node, Edge } from '@xyflow/react';

export type NodeCategory = 'trigger' | 'action' | 'logic' | 'code' | 'ai';

export type NodeTypeKey =
  | 'manualTrigger'
  | 'webhookTrigger'
  | 'scheduleTrigger'
  | 'httpRequest'
  | 'codeNode'
  | 'ifCondition'
  | 'setFields'
  | 'filterItems'
  | 'aiAgent'
  | 'delayNode'
  | 'slackNotify';

export type ExecutionStatus = 'idle' | 'running' | 'success' | 'error' | 'skipped';

export interface DataItem {
  [key: string]: any;
}

export interface SetFieldRule {
  id: string;
  key: string;
  value: string;
  type: 'string' | 'number' | 'boolean' | 'expression';
}

export interface ConditionRule {
  field: string;
  operator: 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'contains' | 'exists';
  value: string;
}

export interface NodeConfig {
  // Trigger payload
  samplePayload?: string;
  webhookPath?: string;
   webhookMethod?: 'POST' | 'GET';
  cronExpression?: string;

  // HTTP Request
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: string;
  body?: string;

  // Code Node
  jsCode?: string;

  // IF / Filter Condition
  condition?: ConditionRule;

  // Set / Transform Fields
  fields?: SetFieldRule[];
  keepExistingFields?: boolean;

  // AI Agent
  model?: string;
  systemPrompt?: string;
  userPrompt?: string;

  // Delay
  delayMs?: number;

  // Slack / Notification
  channel?: string;
  messageTemplate?: string;
}

export interface WorkflowNodeData extends Record<string, unknown> {
  label: string;
  subtitle?: string;
  typeKey: NodeTypeKey;
  category: NodeCategory;
  config: NodeConfig;
  status: ExecutionStatus;
  executionTimeMs?: number;
  errorMessage?: string;
  inputData: DataItem[];
  outputData: DataItem[];
  // For IF node dual outputs
  trueOutputData?: DataItem[];
  falseOutputData?: DataItem[];
  onQuickRun?: (nodeId: string) => void;
  onOpenInspector?: (nodeId: string) => void;
  onDeleteNode?: (nodeId: string) => void;
  onDuplicateNode?: (nodeId: string) => void;
  onQuickAddFromHandle?: (sourceNodeId: string, sourceHandle?: string | null) => void;
}

export type WorkflowNode = Node<WorkflowNodeData, 'pipelineNode'>;

export interface WorkflowEdgeData extends Record<string, unknown> {
  itemCount?: number;
  isExecuting?: boolean;
  isExecuted?: boolean;
  branchLabel?: 'true' | 'false';
  onDeleteEdge?: (edgeId: string) => void;
}

export type WorkflowEdge = Edge<WorkflowEdgeData>;

export interface ExecutionLogEntry {
  id: string;
  nodeId: string;
  nodeLabel: string;
  typeKey: NodeTypeKey;
  status: ExecutionStatus;
  timestamp: string;
  durationMs: number;
  inputCount: number;
  outputCount: number;
  inputPreview: DataItem[];
  outputPreview: DataItem[];
  error?: string;
  branchInfo?: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  badge: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}
