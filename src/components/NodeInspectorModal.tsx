import React, { useState } from 'react';
import {
  X,
  Play,
  Table as TableIcon,
  Braces,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import {
  ConditionRule,
  DataItem,
  NodeConfig,
  SetFieldRule,
  WorkflowNode
} from '../types/workflow';
import { getCatalogItem } from '../data/nodeCatalog';
import { NodeIcon } from './NodeIcon';

interface NodeInspectorModalProps {
  node: WorkflowNode;
  onClose: () => void;
  onUpdateNode: (
    nodeId: string,
    updates: { label?: string; subtitle?: string; config?: NodeConfig }
  ) => void;
  onTestSingleNode: (nodeId: string) => void;
}

const DataViewer: React.FC<{
  items: DataItem[];
  emptyMessage: string;
}> = ({ items, emptyMessage }) => {
  const [viewMode, setViewMode] = useState<'table' | 'json'>('table');

  if (!items || items.length === 0) {
    return (
      <div className="inspector-empty-state">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  const allKeys = Array.from(
    new Set(items.flatMap((item) => (item && typeof item === 'object' ? Object.keys(item) : [])))
  );

  return (
    <div className="inspector-data-container">
      <div className="inspector-data-Subheader">
        <span className="item-count-badge">
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </span>
        <div className="view-mode-toggle">
          <button
            type="button"
            className={viewMode === 'table' ? 'active' : ''}
            onClick={() => setViewMode('table')}
          >
            <TableIcon size={13} /> Table
          </button>
          <button
            type="button"
            className={viewMode === 'json' ? 'active' : ''}
            onClick={() => setViewMode('json')}
          >
            <Braces size={13} /> JSON
          </button>
        </div>
      </div>

      {/* Schema Variable Pills */}
      {allKeys.length > 0 && (
        <div className="schema-pills-bar">
          <span className="schema-label">Fields:</span>
          {allKeys.map((k) => (
            <span
              key={k}
              className="schema-pill"
              title={`Use {{ $json.${k} }} in expressions`}
              onClick={() => {
                navigator.clipboard?.writeText(`{{ $json.${k} }}`);
              }}
            >
              {`{{ $json.${k} }}`}
            </span>
          ))}
        </div>
      )}

      {viewMode === 'table' ? (
        <div className="inspector-table-scroll">
          <table className="inspector-table">
            <thead>
              <tr>
                <th>#</th>
                {allKeys.map((k) => (
                  <th key={k}>{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((row, idx) => (
                <tr key={idx}>
                  <td className="row-index">{idx}</td>
                  {allKeys.map((k) => {
                    const val = row?.[k];
                    const formatted =
                      val === null || val === undefined
                        ? '—'
                        : typeof val === 'object'
                        ? JSON.stringify(val)
                        : String(val);
                    return <td key={k}>{formatted}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <pre className="inspector-json-pre">{JSON.stringify(items, null, 2)}</pre>
      )}
    </div>
  );
};

export const NodeInspectorModal: React.FC<NodeInspectorModalProps> = ({
  node,
  onClose,
  onUpdateNode,
  onTestSingleNode
}) => {
  const catalog = getCatalogItem(node.data.typeKey);
  const [label, setLabel] = useState(node.data.label);
  const [subtitle, setSubtitle] = useState(node.data.subtitle || catalog.subtitle);
  const [config, setConfig] = useState<NodeConfig>(() => ({
    ...node.data.config
  }));
  const [ifBranchTab, setIfBranchTab] = useState<'true' | 'false'>('true');

  const updateConfig = (patch: Partial<NodeConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    onUpdateNode(node.id, { label, subtitle, config: next });
  };

  const handleLabelChange = (val: string) => {
    setLabel(val);
    onUpdateNode(node.id, { label: val, subtitle, config });
  };

  const handleSubtitleChange = (val: string) => {
    setSubtitle(val);
    onUpdateNode(node.id, { label, subtitle: val, config });
  };

  const updateCondition = (patch: Partial<ConditionRule>) => {
    const current: ConditionRule = config.condition || {
      field: 'amount',
      operator: 'greaterThan',
      value: '100'
    };
    updateConfig({ condition: { ...current, ...patch } });
  };

  const addSetField = () => {
    const existing = config.fields || [];
    const next: SetFieldRule[] = [
      ...existing,
      {
        id: `f-${Date.now()}`,
        key: 'newField',
        value: '{{ $json.id }}',
        type: 'string'
      }
    ];
    updateConfig({ fields: next });
  };

  const updateSetField = (id: string, patch: Partial<SetFieldRule>) => {
    const next = (config.fields || []).map((f) =>
      f.id === id ? { ...f, ...patch } : f
    );
    updateConfig({ fields: next });
  };

  const removeSetField = (id: string) => {
    const next = (config.fields || []).filter((f) => f.id !== id);
    updateConfig({ fields: next });
  };

  const outputItemsToShow =
    node.data.typeKey === 'ifCondition'
      ? ifBranchTab === 'true'
        ? node.data.trueOutputData || []
        : node.data.falseOutputData || []
      : node.data.outputData || [];

  return (
    <div className="n8n-inspector-backdrop" onClick={onClose}>
      <div
        className="n8n-inspector-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Header */}
        <div className="n8n-inspector-header">
          <div className="inspector-header-left">
            <div
              className="inspector-node-icon"
              style={{
                background: catalog.bgGlow,
                borderColor: `${catalog.color}55`
              }}
            >
              <NodeIcon
                typeKey={node.data.typeKey}
                size={20}
                color={catalog.color}
              />
            </div>
            <div>
              <input
                type="text"
                className="inspector-title-input"
                value={label}
                onChange={(e) => handleLabelChange(e.target.value)}
              />
              <div className="inspector-type-caption">
                {catalog.label} • {catalog.description}
              </div>
            </div>
          </div>

          <div className="inspector-header-actions">
            <button
              type="button"
              className="n8n-btn-primary"
              onClick={() => onTestSingleNode(node.id)}
            >
              <Play size={14} /> Execute Step
            </button>
            <button
              type="button"
              className="inspector-close-btn"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 3-Column n8n Split Body: INPUT | PARAMETERS | OUTPUT */}
        <div className="n8n-inspector-grid">
          {/* LEFT PANE: INPUT DATA */}
          <div className="n8n-inspector-pane">
            <div className="pane-header">
              <span className="pane-title">INPUT</span>
              <span className="pane-hint">Incoming items from parent node</span>
            </div>
            <DataViewer
              items={node.data.inputData || []}
              emptyMessage={
                catalog.isTrigger
                  ? 'Trigger nodes start the workflow and do not require upstream input.'
                  : 'No input data yet. Click "Execute Workflow" or "Execute Step" to populate.'
              }
            />
          </div>

          {/* CENTER PANE: NODE PARAMETERS */}
          <div className="n8n-inspector-pane center-params-pane">
            <div className="pane-header">
              <span className="pane-title">PARAMETERS</span>
              <span className="pane-hint">Configure node behavior</span>
            </div>

            <div className="params-scroll-body">
              <div className="form-group">
                <label>Node Subtitle / Note</label>
                <input
                  type="text"
                  value={subtitle}
                  onChange={(e) => handleSubtitleChange(e.target.value)}
                  placeholder="Short note shown on canvas node"
                />
              </div>

              {/* TRIGGER NODES */}
              {(node.data.typeKey === 'manualTrigger' ||
                node.data.typeKey === 'webhookTrigger' ||
                node.data.typeKey === 'scheduleTrigger') && (
                <>
                  {node.data.typeKey === 'webhookTrigger' && (
                    <div className="form-row-2">
                      <div className="form-group">
                        <label>HTTP Method</label>
                        <select
                          value={config.webhookMethod || 'POST'}
                          onChange={(e) =>
                            updateConfig({
                              webhookMethod: e.target.value as 'POST' | 'GET'
                            })
                          }
                        >
                          <option value="POST">POST</option>
                          <option value="GET">GET</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Webhook Path</label>
                        <input
                          type="text"
                          value={config.webhookPath || '/webhook/ingest'}
                          onChange={(e) =>
                            updateConfig({ webhookPath: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  )}

                  {node.data.typeKey === 'scheduleTrigger' && (
                    <div className="form-group">
                      <label>Cron Expression</label>
                      <input
                        type="text"
                        value={config.cronExpression || '*/15 * * * *'}
                        onChange={(e) =>
                          updateConfig({ cronExpression: e.target.value })
                        }
                      />
                    </div>
                  )}

                  <div className="form-group">
                    <label>Mock / Seed JSON Payload (Array of Items)</label>
                    <textarea
                      rows={11}
                      className="code-textarea"
                      value={config.samplePayload || '[]'}
                      onChange={(e) =>
                        updateConfig({ samplePayload: e.target.value })
                      }
                    />
                  </div>
                </>
              )}

              {/* HTTP REQUEST NODE */}
              {node.data.typeKey === 'httpRequest' && (
                <>
                  <div className="form-row-2">
                    <div className="form-group">
                      <label>Method</label>
                      <select
                        value={config.method || 'GET'}
                        onChange={(e) =>
                          updateConfig({ method: e.target.value as any })
                        }
                      >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="DELETE">DELETE</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>URL Endpoint</label>
                      <input
                        type="text"
                        value={config.url || ''}
                        onChange={(e) => updateConfig({ url: e.target.value })}
                        placeholder="https://api.example.com/v1/items"
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Headers (JSON)</label>
                    <textarea
                      rows={4}
                      className="code-textarea"
                      value={config.headers || '{\n  "Accept": "application/json"\n}'}
                      onChange={(e) => updateConfig({ headers: e.target.value })}
                    />
                  </div>
                  {config.method !== 'GET' && (
                    <div className="form-group">
                      <label>JSON Body (supports {'{{ $json.field }}'})</label>
                      <textarea
                        rows={5}
                        className="code-textarea"
                        value={config.body || ''}
                        onChange={(e) => updateConfig({ body: e.target.value })}
                      />
                    </div>
                  )}
                </>
              )}

              {/* CODE (JAVASCRIPT) NODE */}
              {node.data.typeKey === 'codeNode' && (
                <div className="form-group">
                  <label>
                    JavaScript Code (<code>items</code> array &{' '}
                    <code>$json</code> available)
                  </label>
                  <textarea
                    rows={13}
                    className="code-textarea"
                    value={config.jsCode || ''}
                    onChange={(e) => updateConfig({ jsCode: e.target.value })}
                  />
                  <span className="field-help">
                    Return an array of objects to pass downstream to the next node.
                  </span>
                </div>
              )}

              {/* IF CONDITION & FILTER NODES */}
              {(node.data.typeKey === 'ifCondition' ||
                node.data.typeKey === 'filterItems') && (
                <div className="condition-builder-box">
                  <div className="form-group">
                    <label>Field Name (from Input JSON)</label>
                    <input
                      type="text"
                      value={config.condition?.field || ''}
                      onChange={(e) =>
                        updateCondition({ field: e.target.value })
                      }
                      placeholder="e.g. amount or plan"
                    />
                  </div>
                  <div className="form-group">
                    <label>Comparison Operator</label>
                    <select
                      value={config.condition?.operator || 'greaterThan'}
                      onChange={(e) =>
                        updateCondition({ operator: e.target.value as any })
                      }
                    >
                      <option value="greaterThan">is greater than (&gt;)</option>
                      <option value="lessThan">is less than (&lt;)</option>
                      <option value="equals">equals (==)</option>
                      <option value="notEquals">does not equal (!=)</option>
                      <option value="contains">contains text</option>
                      <option value="exists">exists / not empty</option>
                    </select>
                  </div>
                  {config.condition?.operator !== 'exists' && (
                    <div className="form-group">
                      <label>Compare Value</label>
                      <input
                        type="text"
                        value={config.condition?.value ?? ''}
                        onChange={(e) =>
                          updateCondition({ value: e.target.value })
                        }
                        placeholder="e.g. 150"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* SET / EDIT FIELDS NODE */}
              {node.data.typeKey === 'setFields' && (
                <>
                  <div className="form-group checkbox-row">
                    <label>
                      <input
                        type="checkbox"
                        checked={config.keepExistingFields !== false}
                        onChange={(e) =>
                          updateConfig({ keepExistingFields: e.target.checked })
                        }
                      />
                      Keep existing input fields on each item
                    </label>
                  </div>

                  <div className="set-fields-list">
                    <div className="set-fields-header">
                      <span>Fields to Set</span>
                      <button
                        type="button"
                        className="small-outline-btn"
                        onClick={addSetField}
                      >
                        <Plus size={12} /> Add Field
                      </button>
                    </div>
                    {(config.fields || []).map((field) => (
                      <div key={field.id} className="set-field-item">
                        <input
                          type="text"
                          placeholder="Field key"
                          value={field.key}
                          onChange={(e) =>
                            updateSetField(field.id, { key: e.target.value })
                          }
                        />
                        <ArrowRight size={13} />
                        <input
                          type="text"
                          placeholder="Value or {{ $json.field }}"
                          value={field.value}
                          onChange={(e) =>
                            updateSetField(field.id, { value: e.target.value })
                          }
                        />
                        <button
                          type="button"
                          className="icon-del-btn"
                          onClick={() => removeSetField(field.id)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* AI AGENT NODE */}
              {node.data.typeKey === 'aiAgent' && (
                <>
                  <div className="form-group">
                    <label>AI Model</label>
                    <select
                      value={config.model || 'gemini-2.5-flash'}
                      onChange={(e) => updateConfig({ model: e.target.value })}
                    >
                      <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                      <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                      <option value="gpt-4o">gpt-4o</option>
                      <option value="claude-3-7-sonnet">claude-3-7-sonnet</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>System Instructions</label>
                    <textarea
                      rows={3}
                      value={config.systemPrompt || ''}
                      onChange={(e) =>
                        updateConfig({ systemPrompt: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>
                      User Prompt Template (supports <code>{'{{ $json.field }}'}</code>)
                    </label>
                    <textarea
                      rows={5}
                      className="code-textarea"
                      value={config.userPrompt || ''}
                      onChange={(e) =>
                        updateConfig({ userPrompt: e.target.value })
                      }
                    />
                  </div>
                </>
              )}

              {/* DELAY NODE */}
              {node.data.typeKey === 'delayNode' && (
                <div className="form-group">
                  <label>Wait Duration (milliseconds)</label>
                  <input
                    type="number"
                    min={100}
                    max={5000}
                    step={100}
                    value={config.delayMs ?? 600}
                    onChange={(e) =>
                      updateConfig({ delayMs: Number(e.target.value) })
                    }
                  />
                </div>
              )}

              {/* SLACK / WEBHOOK OUT NODE */}
              {node.data.typeKey === 'slackNotify' && (
                <>
                  <div className="form-group">
                    <label>Target Channel / Destination</label>
                    <input
                      type="text"
                      value={config.channel || '#ops-alerts'}
                      onChange={(e) => updateConfig({ channel: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>
                      Message Template (supports <code>{'{{ $json.field }}'}</code>)
                    </label>
                    <textarea
                      rows={5}
                      className="code-textarea"
                      value={config.messageTemplate || ''}
                      onChange={(e) =>
                        updateConfig({ messageTemplate: e.target.value })
                      }
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* RIGHT PANE: OUTPUT DATA */}
          <div className="n8n-inspector-pane">
            <div className="pane-header">
              <div className="pane-header-row">
                <span className="pane-title">OUTPUT</span>
                {node.data.status === 'success' && (
                  <span className="output-status-pill success">
                    <CheckCircle2 size={12} /> Success ({node.data.executionTimeMs}
                    ms)
                  </span>
                )}
                {node.data.status === 'error' && (
                  <span className="output-status-pill error">
                    <AlertCircle size={12} /> Error
                  </span>
                )}
              </div>

              {node.data.typeKey === 'ifCondition' && (
                <div className="if-output-branch-tabs">
                  <button
                    type="button"
                    className={ifBranchTab === 'true' ? 'active-true' : ''}
                    onClick={() => setIfBranchTab('true')}
                  >
                    True Branch ({node.data.trueOutputData?.length || 0})
                  </button>
                  <button
                    type="button"
                    className={ifBranchTab === 'false' ? 'active-false' : ''}
                    onClick={() => setIfBranchTab('false')}
                  >
                    False Branch ({node.data.falseOutputData?.length || 0})
                  </button>
                </div>
              )}
            </div>

            {node.data.status === 'error' ? (
              <div className="inspector-error-box">
                <AlertCircle size={18} />
                <div>
                  <strong>Node Execution Failed</strong>
                  <p>{node.data.errorMessage}</p>
                </div>
              </div>
            ) : (
              <DataViewer
                items={outputItemsToShow}
                emptyMessage='Click "Execute Step" above or run the workflow to inspect live output data.'
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
