import { WorkflowTemplate } from '../types/workflow';

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'ecommerce-vip-triage',
    name: 'E-Commerce Order Triage & VIP Routing',
    badge: 'Featured Pipeline',
    description:
      'Ingests incoming orders, enriches tax & tier via JS Code, branches on IF (amount > $150) into VIP AI Concierge vs Standard Queue.',
    nodes: [
      {
        id: 'node-1',
        type: 'pipelineNode',
        position: { x: 60, y: 190 },
        data: {
          label: 'Incoming Orders',
          subtitle: 'Webhook POST /orders',
          typeKey: 'webhookTrigger',
          category: 'trigger',
          status: 'idle',
          inputData: [],
          outputData: [],
          config: {
            webhookMethod: 'POST',
            webhookPath: '/webhook/orders-ingest',
            samplePayload: JSON.stringify(
              [
                {
                  orderId: 'ORD-9041',
                  customer: 'Aria Chen',
                  email: 'aria@nimbus.io',
                  plan: 'Enterprise',
                  amount: 340,
                  country: 'SG'
                },
                {
                  orderId: 'ORD-9042',
                  customer: 'Liam Vance',
                  email: 'liam@startup.dev',
                  plan: 'Starter',
                  amount: 49,
                  country: 'US'
                },
                {
                  orderId: 'ORD-9043',
                  customer: 'Elena Rostova',
                  email: 'elena@quant.ai',
                  plan: 'Enterprise',
                  amount: 820,
                  country: 'DE'
                }
              ],
              null,
              2
            )
          }
        }
      },
      {
        id: 'node-2',
        type: 'pipelineNode',
        position: { x: 370, y: 190 },
        data: {
          label: 'Calculate Tax & Tier',
          subtitle: 'Code (JavaScript)',
          typeKey: 'codeNode',
          category: 'code',
          status: 'idle',
          inputData: [],
          outputData: [],
          config: {
            jsCode: `// Calculate 8% tax and classify order tier
return items.map((item, idx) => {
  const amount = Number(item.amount || 0);
  const tax = +(amount * 0.08).toFixed(2);
  return {
    ...item,
    taxAmount: tax,
    totalWithTax: +(amount + tax).toFixed(2),
    tier: amount >= 200 ? 'VIP_GOLD' : 'STANDARD',
    sequenceNo: idx + 1
  };
});`
          }
        }
      },
      {
        id: 'node-3',
        type: 'pipelineNode',
        position: { x: 690, y: 190 },
        data: {
          label: 'Is High-Value Order?',
          subtitle: 'amount > 150',
          typeKey: 'ifCondition',
          category: 'logic',
          status: 'idle',
          inputData: [],
          outputData: [],
          config: {
            condition: {
              field: 'amount',
              operator: 'greaterThan',
              value: '150'
            }
          }
        }
      },
      {
        id: 'node-4',
        type: 'pipelineNode',
        position: { x: 1030, y: 80 },
        data: {
          label: 'AI VIP Account Brief',
          subtitle: 'gemini-2.5-flash',
          typeKey: 'aiAgent',
          category: 'ai',
          status: 'idle',
          inputData: [],
          outputData: [],
          config: {
            model: 'gemini-2.5-flash',
            systemPrompt: 'Generate concise executive VIP onboarding notes.',
            userPrompt:
              'VIP Order {{ $json.orderId }} from {{ $json.customer }} ({{ $json.country }}) for ${{ $json.totalWithTax }}'
          }
        }
      },
      {
        id: 'node-5',
        type: 'pipelineNode',
        position: { x: 1340, y: 80 },
        data: {
          label: 'Notify #vip-sales',
          subtitle: 'Slack Alert',
          typeKey: 'slackNotify',
          category: 'action',
          status: 'idle',
          inputData: [],
          outputData: [],
          config: {
            channel: '#vip-enterprise-deals',
            messageTemplate:
              '🌟 VIP Deal {{ $json.orderId }}: {{ $json.customer }} — ${{ $json.totalWithTax }} ({{ $json.tier }})'
          }
        }
      },
      {
        id: 'node-6',
        type: 'pipelineNode',
        position: { x: 1030, y: 310 },
        data: {
          label: 'Tag Standard Queue',
          subtitle: 'Set Fulfillment Fields',
          typeKey: 'setFields',
          category: 'code',
          status: 'idle',
          inputData: [],
          outputData: [],
          config: {
            keepExistingFields: true,
            fields: [
              {
                id: 'f-queue',
                key: 'routingQueue',
                value: 'SELF_SERVE_AUTOMATED',
                type: 'string'
              },
              {
                id: 'f-label',
                key: 'receiptLabel',
                value: 'Order {{ $json.orderId }} ({{ $json.customer }})',
                type: 'expression'
              }
            ]
          }
        }
      }
    ],
    edges: [
      {
        id: 'e1-2',
        source: 'node-1',
        target: 'node-2',
        type: 'animatedEdge',
        data: {}
      },
      {
        id: 'e2-3',
        source: 'node-2',
        target: 'node-3',
        type: 'animatedEdge',
        data: {}
      },
      {
        id: 'e3-4-true',
        source: 'node-3',
        sourceHandle: 'true',
        target: 'node-4',
        type: 'animatedEdge',
        data: { branchLabel: 'true' }
      },
      {
        id: 'e4-5',
        source: 'node-4',
        target: 'node-5',
        type: 'animatedEdge',
        data: {}
      },
      {
        id: 'e3-6-false',
        source: 'node-3',
        sourceHandle: 'false',
        target: 'node-6',
        type: 'animatedEdge',
        data: { branchLabel: 'false' }
      }
    ]
  },
  {
    id: 'live-rest-api-sync',
    name: 'Live REST API Fetch & User Enrichment',
    badge: 'Live HTTP Fetch',
    description:
      'Makes a real HTTP GET call to JSONPlaceholder API, extracts company & contact fields with JS Code, and formats Slack alerts.',
    nodes: [
      {
        id: 'api-1',
        type: 'pipelineNode',
        position: { x: 80, y: 200 },
        data: {
          label: 'Manual Start',
          subtitle: 'Trigger execution',
          typeKey: 'manualTrigger',
          category: 'trigger',
          status: 'idle',
          inputData: [],
          outputData: [],
          config: {
            samplePayload: JSON.stringify(
              [{ requestSource: 'manual_dashboard', limit: 4 }],
              null,
              2
            )
          }
        }
      },
      {
        id: 'api-2',
        type: 'pipelineNode',
        position: { x: 390, y: 200 },
        data: {
          label: 'Fetch Users API',
          subtitle: 'GET jsonplaceholder/users',
          typeKey: 'httpRequest',
          category: 'action',
          status: 'idle',
          inputData: [],
          outputData: [],
          config: {
            method: 'GET',
            url: 'https://jsonplaceholder.typicode.com/users?_limit=4',
            headers: '{\n  "Accept": "application/json"\n}',
            body: ''
          }
        }
      },
      {
        id: 'api-3',
        type: 'pipelineNode',
        position: { x: 700, y: 200 },
        data: {
          label: 'Normalize User Schema',
          subtitle: 'Code (JavaScript)',
          typeKey: 'codeNode',
          category: 'code',
          status: 'idle',
          inputData: [],
          outputData: [],
          config: {
            jsCode: `return items.map((u) => ({
  userId: u.id,
  name: u.name,
  username: u.username,
  email: u.email,
  city: u.address?.city || 'Remote',
  company: u.company?.name || 'Independent',
  score: (u.id || 1) * 35
}));`
          }
        }
      },
      {
        id: 'api-4',
        type: 'pipelineNode',
        position: { x: 1020, y: 200 },
        data: {
          label: 'Dispatch Directory Sync',
          subtitle: 'Slack #directory-sync',
          typeKey: 'slackNotify',
          category: 'action',
          status: 'idle',
          inputData: [],
          outputData: [],
          config: {
            channel: '#directory-sync',
            messageTemplate:
              'Synced user {{ $json.name }} ({{ $json.email }}) from {{ $json.company }}'
          }
        }
      }
    ],
    edges: [
      {
        id: 'e-api-1-2',
        source: 'api-1',
        target: 'api-2',
        type: 'animatedEdge',
        data: {}
      },
      {
        id: 'e-api-2-3',
        source: 'api-2',
        target: 'api-3',
        type: 'animatedEdge',
        data: {}
      },
      {
        id: 'e-api-3-4',
        source: 'api-3',
        target: 'api-4',
        type: 'animatedEdge',
        data: {}
      }
    ]
  }
];
