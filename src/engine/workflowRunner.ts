import {
  ConditionRule,
  DataItem,
  ExecutionLogEntry,
  ExecutionStatus,
  WorkflowEdge,
  WorkflowNode
} from '../types/workflow';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Evaluates n8n-style {{ $json.field }} expressions against a DataItem
 */
export function evaluateExpression(template: string, item: DataItem): string {
  if (!template) return '';
  return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, expr: string) => {
    try {
      const fn = new Function('$json', 'item', `return (${expr.trim()});`);
      const result = fn(item, item);
      return result !== undefined && result !== null ? String(result) : '';
    } catch {
      const cleanPath = expr.replace(/^\$json\./, '').trim();
      const val = cleanPath.split('.').reduce((acc: any, part) => acc?.[part], item);
      return val !== undefined && val !== null ? String(val) : '';
    }
  });
}

export function checkCondition(item: DataItem, rule?: ConditionRule): boolean {
  if (!rule || !rule.field) return true;
  const fieldPath = rule.field.replace(/^\$json\./, '').trim();
  const rawVal = fieldPath.split('.').reduce((acc: any, k) => acc?.[k], item);
  const targetVal = rule.value ?? '';

  switch (rule.operator) {
    case 'equals':
      return String(rawVal) === String(targetVal);
    case 'notEquals':
      return String(rawVal) !== String(targetVal);
    case 'greaterThan':
      return Number(rawVal) > Number(targetVal);
    case 'lessThan':
      return Number(rawVal) < Number(targetVal);
    case 'contains':
      return String(rawVal ?? '')
        .toLowerCase()
        .includes(String(targetVal).toLowerCase());
    case 'exists':
      return rawVal !== undefined && rawVal !== null && rawVal !== '';
    default:
      return Boolean(rawVal);
  }
}

export interface NodeExecutionResult {
  outputData: DataItem[];
  trueOutputData?: DataItem[];
  falseOutputData?: DataItem[];
  durationMs: number;
}

/**
 * Executes a single node given its input items
 */
export async function executeSingleNodeLogic(
  node: WorkflowNode,
  inputItems: DataItem[],
  stepDelayMs = 420
): Promise<NodeExecutionResult> {
  const start = performance.now();
  const { typeKey, config } = node.data;

  // Give visual breathing room so the user sees the live step-by-step animation
  await sleep(typeKey === 'delayNode' ? Math.min(config.delayMs || 600, 3000) : stepDelayMs);

  const safeInput =
    inputItems.length > 0 ? inputItems : [{ triggeredAt: new Date().toISOString() }];

  switch (typeKey) {
    case 'manualTrigger':
    case 'webhookTrigger':
    case 'scheduleTrigger': {
      let parsed: DataItem[] = [];
      try {
        const raw = JSON.parse(config.samplePayload || '[]');
        parsed = Array.isArray(raw) ? raw : [raw];
      } catch (err: any) {
        throw new Error(`Invalid Trigger JSON payload: ${err.message}`);
      }
      return {
        outputData: parsed,
        durationMs: Math.round(performance.now() - start)
      };
    }

    case 'httpRequest': {
      const url = (config.url || 'https://jsonplaceholder.typicode.com/users?_limit=4').trim();
      const method = config.method || 'GET';
      let headers: Record<string, string> = { Accept: 'application/json' };
      if (config.headers?.trim()) {
        try {
          headers = JSON.parse(config.headers);
        } catch {
          // keep default headers
        }
      }

      const fetchOptions: RequestInit = { method, headers };
      if (method !== 'GET' && config.body?.trim()) {
        fetchOptions.body = evaluateExpression(config.body, safeInput[0]);
      }

      const response = await fetch(url, fetchOptions);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      const normalized: DataItem[] = Array.isArray(data) ? data : [data];

      return {
        outputData: normalized,
        durationMs: Math.round(performance.now() - start)
      };
    }

    case 'codeNode': {
      const code =
        config.jsCode ||
        'return items.map(item => ({ ...item, processed: true }));';
      try {
        const clonedItems = JSON.parse(JSON.stringify(safeInput));
        const runner = new Function(
          'items',
          '$input',
          '$json',
          `"use strict";\n${code}`
        );
        const result = runner(
          clonedItems,
          { all: () => clonedItems, first: () => clonedItems[0] },
          clonedItems[0] || {}
        );
        const outputData = Array.isArray(result)
          ? result
          : result && typeof result === 'object'
          ? [result]
          : [{ result }];
        return {
          outputData,
          durationMs: Math.round(performance.now() - start)
        };
      } catch (err: any) {
        throw new Error(`JS Code Error: ${err.message}`);
      }
    }

    case 'ifCondition': {
      const trueItems: DataItem[] = [];
      const falseItems: DataItem[] = [];
      for (const item of safeInput) {
        if (checkCondition(item, config.condition)) {
          trueItems.push({ ...item, _branch: 'true' });
        } else {
          falseItems.push({ ...item, _branch: 'false' });
        }
      }
      return {
        outputData: [...trueItems, ...falseItems],
        trueOutputData: trueItems,
        falseOutputData: falseItems,
        durationMs: Math.round(performance.now() - start)
      };
    }

    case 'filterItems': {
      const filtered = safeInput.filter((item) =>
        checkCondition(item, config.condition)
      );
      return {
        outputData: filtered,
        durationMs: Math.round(performance.now() - start)
      };
    }

    case 'setFields': {
      const keep = config.keepExistingFields !== false;
      const fields = config.fields || [];
      const outputData = safeInput.map((item) => {
        const base: DataItem = keep ? { ...item } : {};
        for (const f of fields) {
          if (!f.key.trim()) continue;
          if (f.type === 'number') {
            base[f.key] = Number(evaluateExpression(f.value, item));
          } else if (f.type === 'boolean') {
            base[f.key] =
              evaluateExpression(f.value, item).toLowerCase() === 'true';
          } else {
            base[f.key] = evaluateExpression(f.value, item);
          }
        }
        return base;
      });
      return {
        outputData,
        durationMs: Math.round(performance.now() - start)
      };
    }

    case 'aiAgent': {
      const model = config.model || 'gemini-2.5-flash';
      const promptTpl =
        config.userPrompt || 'Summarize {{ $json.customer || $json.name }}';
      const outputData = safeInput.map((item) => {
        const renderedPrompt = evaluateExpression(promptTpl, item);
        const amountVal = Number(item.totalWithTax ?? item.amount ?? item.score ?? 100);
        const sentiment = amountVal >= 200 ? 'High-Priority Opportunity' : 'Standard Account';
        return {
          ...item,
          aiModel: model,
          aiClassification: sentiment,
          aiSummary: `[${model}] ${renderedPrompt} — Recommended action: ${
            amountVal >= 200
              ? 'Assign dedicated solutions architect & instant onboarding.'
              : 'Send automated welcome sequence.'
          }`,
          confidence: 0.96
        };
      });
      return {
        outputData,
        durationMs: Math.round(performance.now() - start)
      };
    }

    case 'delayNode': {
      return {
        outputData: safeInput.map((item) => ({
          ...item,
          delayedMs: config.delayMs || 600
        })),
        durationMs: Math.round(performance.now() - start)
      };
    }

    case 'slackNotify': {
      const channel = config.channel || '#general';
      const tpl =
        config.messageTemplate || 'Notification for {{ $json.customer || $json.name }}';
      const outputData = safeInput.map((item) => ({
        ...item,
        slackChannel: channel,
        slackMessage: evaluateExpression(tpl, item),
        deliveredAt: new Date().toLocaleTimeString(),
        deliveryStatus: 'SENT_200_OK'
      }));
      return {
        outputData,
        durationMs: Math.round(performance.now() - start)
      };
    }

    default:
      return {
        outputData: safeInput,
        durationMs: Math.round(performance.now() - start)
      };
  }
}

export interface RunPipelineCallbacks {
  onNodeStatusChange: (
    nodeId: string,
    status: ExecutionStatus,
    patch?: Partial<WorkflowNode['data']>
  ) => void;
  onEdgeStatusChange: (
    edgeId: string,
    patch: { isExecuting?: boolean; isExecuted?: boolean; itemCount?: number }
  ) => void;
  onLogEntry: (entry: ExecutionLogEntry) => void;
  shouldStop?: () => boolean;
  waitForNextStepIfPaused?: (nodeLabel: string) => Promise<void>;
}

/**
 * Executes the entire pipeline graph in topological order, respecting IF branches
 */
export async function executeWorkflowGraph(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  callbacks: RunPipelineCallbacks,
  stepDelayMs = 450
): Promise<void> {
  const nodeMap = new Map<string, WorkflowNode>(nodes.map((n) => [n.id, n]));

  // Find start nodes (triggers or nodes with 0 incoming edges)
  const incomingCount = new Map<string, number>();
  nodes.forEach((n) => incomingCount.set(n.id, 0));
  edges.forEach((e) => {
    incomingCount.set(e.target, (incomingCount.get(e.target) || 0) + 1);
  });

  const startNodes = nodes.filter(
    (n) =>
      n.data.category === 'trigger' || (incomingCount.get(n.id) || 0) === 0
  );

  const queue: Array<{ nodeId: string; incomingItems: DataItem[]; viaEdgeId?: string }> =
    startNodes.map((n) => ({ nodeId: n.id, incomingItems: [] }));

  const visitedEdges = new Set<string>();

  while (queue.length > 0) {
    if (callbacks.shouldStop?.()) break;

    const current = queue.shift()!;
    const node = nodeMap.get(current.nodeId);
    if (!node) continue;

    // Wait if in step-by-step interactive pause mode
    if (callbacks.waitForNextStepIfPaused) {
      await callbacks.waitForNextStepIfPaused(node.data.label);
    }

    if (callbacks.shouldStop?.()) break;

    if (current.viaEdgeId) {
      callbacks.onEdgeStatusChange(current.viaEdgeId, {
        isExecuting: true,
        isExecuted: false
      });
    }

    callbacks.onNodeStatusChange(node.id, 'running', {
      inputData: current.incomingItems,
      errorMessage: undefined
    });

    try {
      const result = await executeSingleNodeLogic(
        node,
        current.incomingItems,
        stepDelayMs
      );

      if (current.viaEdgeId) {
        callbacks.onEdgeStatusChange(current.viaEdgeId, {
          isExecuting: false,
          isExecuted: true,
          itemCount: current.incomingItems.length
        });
      }

      callbacks.onNodeStatusChange(node.id, 'success', {
        inputData: current.incomingItems,
        outputData: result.outputData,
        trueOutputData: result.trueOutputData,
        falseOutputData: result.falseOutputData,
        executionTimeMs: result.durationMs
      });

      callbacks.onLogEntry({
        id: `${node.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        nodeId: node.id,
        nodeLabel: node.data.label,
        typeKey: node.data.typeKey,
        status: 'success',
        timestamp: new Date().toLocaleTimeString(),
        durationMs: result.durationMs,
        inputCount: current.incomingItems.length,
        outputCount: result.outputData.length,
        inputPreview: current.incomingItems,
        outputPreview: result.outputData,
        branchInfo:
          node.data.typeKey === 'ifCondition'
            ? `True: ${result.trueOutputData?.length || 0} | False: ${
                result.falseOutputData?.length || 0
              }`
            : undefined
      });

      // Route to outgoing edges
      const outgoingEdges = edges.filter((e) => e.source === node.id);

      for (const edge of outgoingEdges) {
        if (visitedEdges.has(edge.id)) continue;
        visitedEdges.add(edge.id);

        let itemsForBranch = result.outputData;
        if (node.data.typeKey === 'ifCondition') {
          if (edge.sourceHandle === 'true' || edge.data?.branchLabel === 'true') {
            itemsForBranch = result.trueOutputData || [];
          } else if (
            edge.sourceHandle === 'false' ||
            edge.data?.branchLabel === 'false'
          ) {
            itemsForBranch = result.falseOutputData || [];
          }
        }

        if (itemsForBranch.length === 0) {
          // Mark target node as skipped if 0 items flow down this branch
          callbacks.onEdgeStatusChange(edge.id, {
            isExecuting: false,
            isExecuted: false,
            itemCount: 0
          });
          callbacks.onNodeStatusChange(edge.target, 'skipped', {
            inputData: [],
            outputData: []
          });
          continue;
        }

        callbacks.onEdgeStatusChange(edge.id, {
          isExecuting: true,
          itemCount: itemsForBranch.length
        });

        queue.push({
          nodeId: edge.target,
          incomingItems: itemsForBranch,
          viaEdgeId: edge.id
        });
      }
    } catch (error: any) {
      const errMsg = error?.message || 'Execution error';
      if (current.viaEdgeId) {
        callbacks.onEdgeStatusChange(current.viaEdgeId, {
          isExecuting: false,
          isExecuted: true
        });
      }
      callbacks.onNodeStatusChange(node.id, 'error', {
        inputData: current.incomingItems,
        errorMessage: errMsg
      });
      callbacks.onLogEntry({
        id: `${node.id}-${Date.now()}`,
        nodeId: node.id,
        nodeLabel: node.data.label,
        typeKey: node.data.typeKey,
        status: 'error',
        timestamp: new Date().toLocaleTimeString(),
        durationMs: 0,
        inputCount: current.incomingItems.length,
        outputCount: 0,
        inputPreview: current.incomingItems,
        outputPreview: [],
        error: errMsg
      });
      break;
    }
  }
}
