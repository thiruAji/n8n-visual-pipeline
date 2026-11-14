import React from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getBezierPath
} from '@xyflow/react';
import { X } from 'lucide-react';
import { WorkflowEdge } from '../types/workflow';

export const AnimatedEdge: React.FC<EdgeProps<WorkflowEdge>> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition
  });

  const isExecuting = Boolean(data?.isExecuting);
  const isExecuted = Boolean(data?.isExecuted);
  const itemCount = data?.itemCount;
  const branchLabel = data?.branchLabel;

  let strokeColor = '#4b5563';
  if (isExecuting) {
    strokeColor = '#ff6d5a';
  } else if (isExecuted) {
    strokeColor = branchLabel === 'false' ? '#f59e0b' : '#10b981';
  } else if (branchLabel === 'true') {
    strokeColor = '#10b981';
  } else if (branchLabel === 'false') {
    strokeColor = '#f59e0b';
  }

  return (
    <>
      {isExecuting && (
        <path
          d={edgePath}
          fill="none"
          stroke="#ff6d5a"
          strokeWidth={6}
          strokeOpacity={0.22}
          className="edge-glow-path"
        />
      )}
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: isExecuting ? 2.8 : isExecuted ? 2.4 : 2,
          stroke: strokeColor,
          strokeDasharray: isExecuting ? '6 4' : undefined,
          animation: isExecuting ? 'n8nEdgeDash 0.55s linear infinite' : undefined
        }}
      />

      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all'
          }}
          className="nodrag nopan n8n-edge-label-wrap"
        >
          {branchLabel && (
            <span
              className={`n8n-edge-branch-tag ${
                branchLabel === 'true' ? 'branch-true' : 'branch-false'
              }`}
            >
              {branchLabel}
            </span>
          )}

          {typeof itemCount === 'number' && (
            <span
              className={`n8n-edge-item-pill ${
                itemCount > 0 ? 'has-items' : 'zero-items'
              }`}
            >
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </span>
          )}

          {data?.onDeleteEdge && (
            <button
              type="button"
              title="Remove connection"
              className="n8n-edge-delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                data.onDeleteEdge?.(id);
              }}
            >
              <X size={11} />
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};
