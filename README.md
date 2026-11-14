# n8n FlowStudio — Visual Pipeline & Workflow Builder

A standalone **n8n-inspired visual pipeline builder** built with **React 18**, **TypeScript**, **Vite**, and **React Flow (`@xyflow/react`)**.

## Features
- **Interactive Drag-and-Drop Canvas**: Pan, zoom, MiniMap, animated data-flow edges, and quick-add `+` node handles.
- **11 Built-in Node Types**:
  - **Triggers**: Manual Trigger, Webhook Trigger, Schedule Trigger
  - **Actions & Network**: HTTP Request (live `fetch` calls), Slack / Webhook Out
  - **Flow & Logic**: IF Condition (`true` / `false` dual branching), Filter Items, Wait / Delay
  - **Code & Transform**: Code (JavaScript with `items` and `$json`), Edit Fields (Set)
  - **AI & LLM**: AI Agent node with `{{ $json.field }}` expression interpolation
- **Live Step-by-Step Execution**:
  - Watch items flow across nodes with item count badges (`3 items`) and execution duration (`ms`).
  - Supports **Live Step-by-Step**, **Fast Execution**, and **Interactive Pause-by-Step Debugger** modes.
- **3-Pane n8n Node Inspector**:
  - Inspect live **INPUT** data, edit **PARAMETERS**, and inspect **OUTPUT** data in Table or JSON views.
- **Import / Export JSON**: Save and share workflows as `.n8n.json` files.

## Getting Started

```bash
npm install
npm run dev
```
