import { NodeCategory, NodeConfig, NodeTypeKey } from '../types/workflow';

export interface NodeCatalogItem {
  typeKey: NodeTypeKey;
  label: string;
  subtitle: string;
  description: string;
  category: NodeCategory;
  color: string;
  bgGlow: string;
  iconName: string;
  isTrigger?: boolean;
  hasDualOutput?: boolean;
  defaultConfig: NodeConfig;
}

export const CATEGORY_META: Record<
  NodeCategory,
  { title: string; color: string; badgeBg: string }
> = {
  trigger: {
    title: 'Triggers',
    color: '#ff6d5a',
    badgeBg: 'rgba(255, 109, 90, 0.14)'
  },
  action: {
    title: 'Actions & Network',
    color: '#3b82f6',
    badgeBg: 'rgba(59, 130, 246, 0.14)'
  },
  logic: {
    title: 'Flow & Logic',
    color: '#f59e0b',
    badgeBg: 'rgba(245, 158, 11, 0.14)'
  },
  code: {
    title: 'Code & Data Transform',
    color: '#10b981',
    badgeBg: 'rgba(16, 185, 129, 0.14)'
  },
  ai: {
    title: 'AI & LLM Agents',
    color: '#a855f7',
    badgeBg: 'rgba(168, 85, 247, 0.14)'
  }
};

export const NODE_CATALOG: NodeCatalogItem[] = [
  {
    typeKey: 'manualTrigger',
    label: 'Manual Trigger',
    subtitle: 'On clicking Execute',
    description: 'Starts the workflow manually with customizable JSON seed items.',
    category: 'trigger',
    color: '#ff6d5a',
    bgGlow: 'rgba(255, 109, 90, 0.2)',
    iconName: 'Play',
    isTrigger: true,
    defaultConfig: {
      samplePayload: JSON.stringify(
        [
          {
            orderId: 'ORD-9041',
            customer: 'Aria Chen',
            email: 'aria@nimbus.io',
            plan: 'Enterprise',
            amount: 340,
            country: 'SG',
            itemsCount: 4
          },
          {
            orderId: 'ORD-9042',
            customer: 'Liam Vance',
            email: 'liam@startup.dev',
            plan: 'Starter',
            amount: 49,
            country: 'US',
            itemsCount: 1
          },
          {
            orderId: 'ORD-9043',
            customer: 'Elena Rostova',
            email: 'elena@quant.ai',
            plan: 'Enterprise',
            amount: 820,
            country: 'DE',
            itemsCount: 9
          }
        ],
        null,
        2
      )
    }
  },
  {
    typeKey: 'webhookTrigger',
    label: 'Webhook',
    subtitle: 'POST /webhook/ingest',
    description: 'Starts workflow when an incoming HTTP webhook payload arrives.',
    category: 'trigger',
    color: '#ff6d5a',
    bgGlow: 'rgba(255, 109, 90, 0.2)',
    iconName: 'Webhook',
    isTrigger: true,
    defaultConfig: {
      webhookMethod: 'POST',
      webhookPath: '/webhook/orders-v2',
      samplePayload: JSON.stringify(
        [
          {
            event: 'payment.succeeded',
            orderId: 'WH-771',
            customer: 'Marcus Sterling',
            amount: 275,
            currency: 'USD',
            priority: true
          },
          {
            event: 'payment.succeeded',
            orderId: 'WH-772',
            customer: 'Sofia Patel',
            amount: 65,
            currency: 'USD',
            priority: false
          }
        ],
        null,
        2
      )
    }
  },
  {
    typeKey: 'scheduleTrigger',
    label: 'Schedule Trigger',
    subtitle: 'Every 15 minutes',
    description: 'Runs workflow on a recurring cron schedule.',
    category: 'trigger',
    color: '#ff6d5a',
    bgGlow: 'rgba(255, 109, 90, 0.2)',
    iconName: 'Clock',
    isTrigger: true,
    defaultConfig: {
      cronExpression: '*/15 * * * *',
      samplePayload: JSON.stringify(
        [
          {
            scheduledRun: true,
            batchWindow: '15m',
            triggeredAt: new Date().toISOString()
          }
        ],
        null,
        2
      )
    }
  },
  {
    typeKey: 'httpRequest',
    label: 'HTTP Request',
    subtitle: 'GET / POST REST API',
    description: 'Fetch live data from any REST endpoint or send HTTP payloads.',
    category: 'action',
    color: '#3b82f6',
    bgGlow: 'rgba(59, 130, 246, 0.2)',
    iconName: 'Globe',
    defaultConfig: {
      method: 'GET',
      url: 'https://jsonplaceholder.typicode.com/users?_limit=4',
      headers: '{\n  "Accept": "application/json"\n}',
      body: ''
    }
  },
  {
    typeKey: 'codeNode',
    label: 'Code (JavaScript)',
    subtitle: 'Run custom JS on items',
    description: 'Write custom JavaScript using items / $input to transform data.',
    category: 'code',
    color: '#10b981',
    bgGlow: 'rgba(16, 185, 129, 0.2)',
    iconName: 'Code2',
    defaultConfig: {
      jsCode: `// Transform each incoming item (n8n style)
return items.map((item, index) => {
  const amount = Number(item.amount ?? item.id * 85 ?? 100);
  const tax = +(amount * 0.08).toFixed(2);
  return {
    ...item,
    stepIndex: index + 1,
    taxAmount: tax,
    totalWithTax: +(amount + tax).toFixed(2),
    tier: amount >= 200 ? 'VIP_GOLD' : 'STANDARD',
    processedAt: new Date().toLocaleTimeString()
  };
});`
    }
  },
  {
    typeKey: 'ifCondition',
    label: 'IF Condition',
    subtitle: 'Branch True / False',
    description: 'Splits items to True or False branches based on a condition rule.',
    category: 'logic',
    color: '#f59e0b',
    bgGlow: 'rgba(245, 158, 11, 0.2)',
    iconName: 'GitBranch',
    hasDualOutput: true,
    defaultConfig: {
      condition: {
        field: 'amount',
        operator: 'greaterThan',
        value: '150'
      }
    }
  },
  {
    typeKey: 'setFields',
    label: 'Edit Fields (Set)',
    subtitle: 'Add or map JSON fields',
    description: 'Set, rename, or compute new fields on every item passing through.',
    category: 'code',
    color: '#10b981',
    bgGlow: 'rgba(16, 185, 129, 0.2)',
    iconName: 'SlidersHorizontal',
    defaultConfig: {
      keepExistingFields: true,
      fields: [
        {
          id: 'f1',
          key: 'pipelineStatus',
          value: 'VERIFIED',
          type: 'string'
        },
        {
          id: 'f2',
          key: 'summaryLabel',
          value: '{{ $json.customer || $json.name }} ({{ $json.tier || "Active" }})',
          type: 'expression'
        }
      ]
    }
  },
  {
    typeKey: 'filterItems',
    label: 'Filter Items',
    subtitle: 'Keep matching items',
    description: 'Filters array of items and only passes items that match the rule.',
    category: 'logic',
    color: '#f59e0b',
    bgGlow: 'rgba(245, 158, 11, 0.2)',
    iconName: 'Filter',
    defaultConfig: {
      condition: {
        field: 'amount',
        operator: 'greaterThan',
        value: '50'
      }
    }
  },
  {
    typeKey: 'aiAgent',
    label: 'AI Agent / LLM',
    subtitle: 'Analyze & enrich items',
    description: 'Uses an AI prompt with {{ $json }} expressions to classify or summarize items.',
    category: 'ai',
    color: '#a855f7',
    bgGlow: 'rgba(168, 85, 247, 0.2)',
    iconName: 'Sparkles',
    defaultConfig: {
      model: 'gemini-2.5-flash',
      systemPrompt: 'You are an automated revenue & operations analyst.',
      userPrompt: 'Summarize customer {{ $json.customer || $json.name }} with value ${{ $json.amount || $json.totalWithTax }}'
    }
  },
  {
    typeKey: 'delayNode',
    label: 'Wait / Delay',
    subtitle: 'Pause execution',
    description: 'Pauses pipeline execution for a specified duration in milliseconds.',
    category: 'logic',
    color: '#f59e0b',
    bgGlow: 'rgba(245, 158, 11, 0.2)',
    iconName: 'Timer',
    defaultConfig: {
      delayMs: 600
    }
  },
  {
    typeKey: 'slackNotify',
    label: 'Slack / Webhook Out',
    subtitle: 'Send channel alert',
    description: 'Formats a notification payload for Slack or downstream webhooks.',
    category: 'action',
    color: '#3b82f6',
    bgGlow: 'rgba(59, 130, 246, 0.2)',
    iconName: 'Send',
    defaultConfig: {
      channel: '#ops-alerts',
      messageTemplate: '🚀 Alert for {{ $json.customer || $json.name }} — Total: ${{ $json.totalWithTax || $json.amount }}'
    }
  }
];

export function getCatalogItem(typeKey: NodeTypeKey): NodeCatalogItem {
  return NODE_CATALOG.find((item) => item.typeKey === typeKey) || NODE_CATALOG[0];
}
