import React from 'react';
import { Handle, NodeProps, Position } from '@xyflow/react';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Play,
  Eye,
  Copy,
  Trash2,
  Plus,
  MinusCircle
} from 'lucide-react';
import { WorkflowNode } from '../types/workflow';
import { getCatalogItem } from '../data/nodeCatalog';
import { NodeIcon } from './NodeIcon';

export const CanvasNode: React.FC<NodeProps<WorkflowNode>> = ({
  id,
  data,
  selected
}) => {
  const catalog = getCatalogItem(data.typeKey);
  const isTrigger = catalog.isTrigger;
  const hasDualOutput = catalog.hasDualOutput;

  const statusClass =
    data.status === 'running'
      ? 'node-running'
      : data.status === 'success'
      ? 'node-success'
      : data.status === 'error'
      ? 'node-error'
      : data.status === 'skipped'
      ? 'node-skipped'
      : '';

  return (
    <div
      className={`n8n-node-card ${isTrigger ? 'is-trigger-node' : ''} ${
        selected ? 'is-selected' : ''
      } ${statusClass}`}
      onDoubleClick={(e) => {
        e.stopPropagation();
        data.onOpenInspector?.(id);
      }}
    >
      {/* Hover Quick Action Bar */}
      <div className="n8n-node-toolbar nodrag">
        <button
          type="button"
          title="Execute this node"
          onClick={(e) => {
            e.stopPropagation();
            data.onQuickRun?.(id);
          }}
        >
          <Play size={12} />
        </button>
        <button
          type="button"
          title="Inspect Input / Output & Configure"
          onClick={(e) => {
            e.stopPropagation();
            data.onOpenInspector?.(id);
          }}
        >
          <Eye size={12} />
        </button>
        <button
          type="button"
          title="Duplicate node"
          onClick={(e) => {
            e.stopPropagation();
            data.onDuplicateNode?.(id);
          }}
        >
          <Copy size={12} />
        </button>
        <button
          type="button"
          className="danger"
          title="Delete node"
          onClick={(e) => {
            e.stopPropagation();
            data.onDeleteNode?.(id);
          }}
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Left Input Handle (only for non-trigger nodes) */}
      {!isTrigger && (
        <Handle
          type="target"
          position={Position.Left}
          className="n8n-handle target-handle"
        />
      )}

      {/* Colored Left Accent Strip */}
      <div
        className="n8n-node-accent"
        style={{ background: catalog.color }}
      />

      {/* Main Node Content */}
      <div className="n8n-node-body">
        <div
          className="n8n-node-icon-box"
          style={{
            background: catalog.bgGlow,
            borderColor: `${catalog.color}44`
          }}
        >
          <NodeIcon typeKey={data.typeKey} size={20} color={catalog.color} />
        </div>

        <div className="n8n-node-text">
          <div className="n8n-node-title">{data.label}</div>
          <div className="n8n-node-subtitle">
            {data.subtitle || catalog.subtitle}
          </div>
        </div>

        {/* Status Indicator Badge */}
        <div className="n8n-node-status-icon">
          {data.status === 'running' && (
            <Loader2 size={16} className="spin-icon" color="#ff6d5a" />
          )}
          {data.status === 'success' && (
            <CheckCircle2 size={16} color="#10b981" />
          )}
          {data.status === 'error' && (
            <AlertCircle size={16} color="#ef4444" />
          )}
          {data.status === 'skipped' && (
            <MinusCircle size={15} color="#6b7280" />
          )}
        </div>
      </div>

      {/* Execution Footer Bar (shows item counts + timing when executed) */}
      {data.status !== 'idle' && (
        <div
          className={`n8n-node-footer status-${data.status}`}
          onClick={(e) => {
            e.stopPropagation();
            data.onOpenInspector?.(id);
          }}
        >
          {data.status === 'running' && <span>Executing step...</span>}
          {data.status === 'success' && (
            <>
              <span className="footer-count">
                {data.outputData?.length || 0}{' '}
                {data.outputData?.length === 1 ? 'item' : 'items'}
              </span>
              {typeof data.executionTimeMs === 'number' && (
                <span className="footer-time">{data.executionTimeMs}ms</span>
              )}
              <span className="footer-inspect-link">Inspect →</span>
            </>
          )}
          {data.status === 'error' && (
            <span className="footer-error-text" title={data.errorMessage}>
              {data.errorMessage || 'Execution failed'}
            </span>
          )}
          {data.status === 'skipped' && (
            <span className="footer-skipped-text">Branch skipped (0 items)</span>
          )}
        </div>
      )}

      {/* Right Output Handle(s) */}
      {hasDualOutput ? (
        <>
          <div className="n8n-dual-handle-label true-label">true</div>
          <Handle
            type="source"
            id="true"
            position={Position.Right}
            style={{ top: '34%', background: '#10b981' }}
            className="n8n-handle source-handle dual-true"
          />
          <button
            type="button"
            title="Add node to TRUE branch"
            className="n8n-quick-plus-btn dual-true-plus nodrag"
            onClick={(e) => {
              e.stopPropagation();
              data.onQuickAddFromHandle?.(id, 'true');
            }}
          >
            <Plus size={10} />
          </button>

          <div className="n8n-dual-handle-label false-label">false</div>
          <Handle
            type="source"
            id="false"
            position={Position.Right}
            style={{ top: '70%', background: '#f59e0b' }}
            className="n8n-handle source-handle dual-false"
          />
          <button
            type="button"
            title="Add node to FALSE branch"
            className="n8n-quick-plus-btn dual-false-plus nodrag"
            onClick={(e) => {
              e.stopPropagation();
              data.onQuickAddFromHandle?.(id, 'false');
            }}
          >
            <Plus size={10} />
          </button>
        </>
      ) : (
        <>
          <Handle
            type="source"
            position={Position.Right}
            className="n8n-handle source-handle"
          />
          <button
            type="button"
            title="Quick-add connected node"
            className="n8n-quick-plus-btn single-plus nodrag"
            onClick={(e) => {
              e.stopPropagation();
              data.onQuickAddFromHandle?.(id, null);
            }}
          >
            <Plus size={10} />
          </button>
        </>
      )}
    </div>
  );
};
