import React from 'react';
import {
  Play,
  Webhook,
  Clock,
  Globe,
  Code2,
  GitBranch,
  SlidersHorizontal,
  Filter,
  Sparkles,
  Timer,
  Send,
  Box
} from 'lucide-react';
import { NodeTypeKey } from '../types/workflow';

interface NodeIconProps {
  typeKey: NodeTypeKey;
  size?: number;
  color?: string;
}

export const NodeIcon: React.FC<NodeIconProps> = ({
  typeKey,
  size = 18,
  color = 'currentColor'
}) => {
  switch (typeKey) {
    case 'manualTrigger':
      return <Play size={size} color={color} />;
    case 'webhookTrigger':
      return <Webhook size={size} color={color} />;
    case 'scheduleTrigger':
      return <Clock size={size} color={color} />;
    case 'httpRequest':
      return <Globe size={size} color={color} />;
    case 'codeNode':
      return <Code2 size={size} color={color} />;
    case 'ifCondition':
      return <GitBranch size={size} color={color} />;
    case 'setFields':
      return <SlidersHorizontal size={size} color={color} />;
    case 'filterItems':
      return <Filter size={size} color={color} />;
    case 'aiAgent':
      return <Sparkles size={size} color={color} />;
    case 'delayNode':
      return <Timer size={size} color={color} />;
    case 'slackNotify':
      return <Send size={size} color={color} />;
    default:
      return <Box size={size} color={color} />;
  }
};
