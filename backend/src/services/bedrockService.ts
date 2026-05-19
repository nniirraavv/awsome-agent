import {
  BedrockRuntimeClient,
  ConverseStreamCommand,
  type Message,
  type ContentBlock,
} from '@aws-sdk/client-bedrock-runtime';
import type { WebSocket } from 'ws';
import type { MCPSession } from './mcpManager.js';
import { callMCPTool } from './mcpManager.js';
import type { Tenant, ServerEvent } from '../types/index.js';

const MAX_HISTORY_TURNS = 20;

let bedrockClient: BedrockRuntimeClient | null = null;
function getBedrock() {
  if (!bedrockClient) {
    bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION ?? 'us-east-1' });
  }
  return bedrockClient;
}

function buildSystemPrompt(tenant: Tenant): string {
  return `You are an expert AWS DevOps assistant helping engineers manage and troubleshoot their AWS infrastructure.

TENANT CONTEXT:
- AWS Account ID: ${tenant.awsAccountId}
- Detected AWS Services in this account: ${tenant.detectedServices.join(', ') || 'none detected yet'}
- Available MCP tools loaded for this session: ${tenant.activeMcpServers.join(', ') || 'none'}

YOUR CAPABILITIES:
1. Answer any generic AWS question — services, architecture, best practices, pricing
2. Query the engineer's live AWS account using the MCP tools available in this session
3. Detect issues: unused resources, CloudWatch alarms, cost anomalies, IAM misconfigurations
4. Provide specific remediation steps with AWS CLI commands or console deep links

INVESTIGATION APPROACH:
- For troubleshooting: always check CloudWatch metrics AND CloudTrail changes together
- For cost questions: check current usage AND historical trends AND Trusted Advisor
- For security: check IAM policies AND Security Hub findings together
- Always cite which tool and metric you used to reach a conclusion
- Structure findings as: ISSUE FOUND → ROOT CAUSE → RECOMMENDED FIX

RESPONSE FORMAT:
- Use markdown: headers, bullet points, code blocks
- Code blocks for all AWS CLI commands
- For findings use this structure:
    ## Issue Found
    ## Root Cause
    ## Recommended Fix
    ## Evidence (which metric/log/tool confirmed this)
- Be concise and technical — the audience is experienced DevOps engineers
- Always state the time range when referencing live metric data

CONSTRAINTS:
- You have READ-ONLY access — never suggest or attempt write/delete operations via tools
- Only query services listed in "Detected AWS Services" — do not query services not in that list
- If a service is not detected, say: "I don't see {service} in your account's detected services. If you've recently added it, click 'Rescan my account' to refresh the service list."
- Scope all MCP tool calls to the tenant's account using their assumed IAM role credentials
- Never expose credential values, session tokens, or internal tenant IDs in responses`;
}

function bedrockToolsFromMCP(mcpTools: MCPSession['tools']): Array<{ toolSpec: { name: string; description: string; inputSchema: { json: unknown } } }> {
  return mcpTools.map(t => ({
    toolSpec: {
      name: t.name,
      description: t.description ?? '',
      inputSchema: {
        json: (t.inputSchema as unknown) ?? { type: 'object', properties: {} },
      },
    },
  }));
}

function send(ws: WebSocket, event: ServerEvent): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(event));
  }
}

const MAX_TOOLS = 20;

export async function streamChat(
  ws: WebSocket,
  tenant: Tenant,
  mcpSession: MCPSession,
  history: Message[],
  userMessage: string
): Promise<Message[]> {
  const messages: Message[] = [
    ...history.slice(-MAX_HISTORY_TURNS * 2),
    { role: 'user', content: [{ text: userMessage }] },
  ];

  const MODEL_ID = process.env.BEDROCK_MODEL_ID ?? 'us.amazon.nova-pro-v1:0';
  const allTools = bedrockToolsFromMCP(mcpSession.tools);
  // Bedrock rejects or hangs on requests with too many tools — cap at MAX_TOOLS
  const tools = allTools.slice(0, MAX_TOOLS);
  console.log(`[bedrock] model=${MODEL_ID} tools=${allTools.length} (capped to ${tools.length})`);
  const systemPrompt = buildSystemPrompt(tenant);

  let continueLoop = true;

  while (continueLoop) {
    console.log('[bedrock] sending ConverseStreamCommand...');
    const stream = await getBedrock().send(
      new ConverseStreamCommand({
        modelId: MODEL_ID,
        system: [{ text: systemPrompt }],
        messages,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        toolConfig: tools.length > 0 ? { tools: tools as any } : undefined,
        inferenceConfig: { maxTokens: 4096 },
      })
    );

    let assistantText = '';
    const toolUseBlocks: Array<{ toolUseId: string; name: string; input: string }> = [];
    let currentToolUse: { toolUseId: string; name: string; inputJson: string } | null = null;
    let stopReason = 'end_turn';
    let inThinking = false;
    let thinkBuf = '';

    console.log('[bedrock] stream opened, consuming events...');
    for await (const event of stream.stream ?? []) {
      if (event.contentBlockStart?.start?.toolUse) {
        const tu = event.contentBlockStart.start.toolUse;
        currentToolUse = { toolUseId: tu.toolUseId ?? '', name: tu.name ?? '', inputJson: '' };
        const serverPkg = mcpSession.toolServerMap.get(tu.name ?? '') ?? '';
        send(ws, { type: 'tool_start', toolName: tu.name ?? '', mcpServer: serverPkg });
      } else if (event.contentBlockDelta?.delta?.text) {
        thinkBuf += event.contentBlockDelta.delta.text;
        // Strip <thinking>...</thinking> blocks (Nova Pro extended thinking)
        let toSend = '';
        while (true) {
          if (!inThinking) {
            const s = thinkBuf.indexOf('<thinking>');
            if (s === -1) { toSend += thinkBuf; thinkBuf = ''; break; }
            toSend += thinkBuf.slice(0, s);
            thinkBuf = thinkBuf.slice(s + '<thinking>'.length);
            inThinking = true;
          } else {
            const e = thinkBuf.indexOf('</thinking>');
            if (e === -1) { thinkBuf = ''; break; }
            thinkBuf = thinkBuf.slice(e + '</thinking>'.length);
            inThinking = false;
          }
        }
        if (toSend) { assistantText += toSend; send(ws, { type: 'text_delta', delta: toSend }); }
      } else if (event.contentBlockDelta?.delta?.toolUse?.input && currentToolUse) {
        currentToolUse.inputJson += event.contentBlockDelta.delta.toolUse.input;
      } else if (event.contentBlockStop && currentToolUse) {
        toolUseBlocks.push({
          toolUseId: currentToolUse.toolUseId,
          name: currentToolUse.name,
          input: currentToolUse.inputJson,
        });
        send(ws, { type: 'tool_end', toolName: currentToolUse.name });
        currentToolUse = null;
      } else if (event.messageStop) {
        stopReason = event.messageStop.stopReason ?? 'end_turn';
      }
    }

    // Add assistant turn to history
    const assistantContent: ContentBlock[] = [];
    if (assistantText) assistantContent.push({ text: assistantText });
    for (const tu of toolUseBlocks) {
      let parsed: Record<string, unknown> = {};
      try { parsed = JSON.parse(tu.input || '{}'); } catch { /* ignore */ }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      assistantContent.push({ toolUse: { toolUseId: tu.toolUseId, name: tu.name, input: parsed as any } });
    }
    messages.push({ role: 'assistant', content: assistantContent });

    if (stopReason !== 'tool_use' || toolUseBlocks.length === 0) {
      continueLoop = false;
      send(ws, { type: 'message_end' });
      break;
    }

    // Execute tool calls and add results
    const toolResults: ContentBlock[] = await Promise.all(
      toolUseBlocks.map(async (tu) => {
        let resultText: string;
        try {
          let parsed: Record<string, unknown> = {};
          try { parsed = JSON.parse(tu.input || '{}'); } catch { /* ignore */ }
          resultText = await callMCPTool(mcpSession, tu.name, parsed);
        } catch (err: unknown) {
          resultText = `Error calling tool ${tu.name}: ${String(err)}`;
        }
        return {
          toolResult: {
            toolUseId: tu.toolUseId,
            content: [{ text: resultText }],
            status: 'success' as const,
          },
        };
      })
    );

    messages.push({ role: 'user', content: toolResults });
  }

  return messages;
}
