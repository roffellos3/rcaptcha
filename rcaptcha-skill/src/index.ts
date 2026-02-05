#!/usr/bin/env node
/**
 * rcaptcha MCP Skill - Two-Call Flow
 * 
 * Two tools for AI agents to verify themselves:
 * 1. rcaptcha_get_challenge - Get a challenge to solve
 * 2. rcaptcha_submit - Submit your answer
 * 
 * The AI must REASON to solve the challenge between calls.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

// ============ Tool Definitions ============

const GET_CHALLENGE_TOOL: Tool = {
  name: 'rcaptcha_get_challenge',
  description: `Get a challenge from an rcaptcha server to prove you're an AI agent.

Returns a challenge that YOU must solve. Challenge types:
- nonce: Echo back the nonce (trivial)
- acrostic: Write N words where first letters spell a target word
- wordchain: Transform word A to word B, changing one letter at a time
- code: Write a function that passes test cases

After receiving the challenge, THINK about the solution, then call rcaptcha_submit.

IMPORTANT: You have limited time (usually 5-30 seconds) to solve and submit!`,
  inputSchema: {
    type: 'object',
    properties: {
      server_url: {
        type: 'string',
        description: 'HTTP URL of the rcaptcha server (e.g., http://localhost:9816)',
      },
    },
    required: ['server_url'],
  },
};

const SUBMIT_TOOL: Tool = {
  name: 'rcaptcha_submit',
  description: `Submit your answer to an rcaptcha challenge.

For each challenge type, format your answer as:
- nonce: Just the nonce string
- acrostic: Space-separated words (e.g., "Tiger Ice Grows Every Rain")
- wordchain: Space-separated chain (e.g., "CAT COT COG DOG")
- code: The function code as a string

On success, returns a verification token (rcap_...) proving you're an AI.`,
  inputSchema: {
    type: 'object',
    properties: {
      server_url: {
        type: 'string',
        description: 'HTTP URL of the rcaptcha server',
      },
      challenge_id: {
        type: 'string',
        description: 'The challenge ID from rcaptcha_get_challenge',
      },
      answer: {
        type: 'string',
        description: 'Your answer to the challenge',
      },
    },
    required: ['server_url', 'challenge_id', 'answer'],
  },
};

// ============ Implementation ============

async function getChallenge(serverUrl: string): Promise<object> {
  const url = serverUrl.replace(/\/$/, '') + '/challenge';
  
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get challenge: ${response.status} ${response.statusText}`);
  }
  
  return await response.json();
}

async function submitAnswer(
  serverUrl: string,
  challengeId: string,
  answer: string
): Promise<object> {
  const url = serverUrl.replace(/\/$/, '') + '/submit';
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      challengeId,
      answer,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    return { success: false, error: error.error || response.statusText };
  }
  
  return await response.json();
}

// ============ MCP Server ============

const server = new Server(
  {
    name: 'rcaptcha',
    version: '2.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [GET_CHALLENGE_TOOL, SUBMIT_TOOL],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'rcaptcha_get_challenge') {
    const serverUrl = args?.server_url as string;
    if (!serverUrl) {
      throw new Error('server_url is required');
    }
    
    try {
      const challenge = await getChallenge(serverUrl);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(challenge, null, 2),
        }],
      };
    } catch (err) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ error: String(err) }, null, 2),
        }],
        isError: true,
      };
    }
  }

  if (name === 'rcaptcha_submit') {
    const serverUrl = args?.server_url as string;
    const challengeId = args?.challenge_id as string;
    const answer = args?.answer as string;
    
    if (!serverUrl || !challengeId || answer === undefined) {
      throw new Error('server_url, challenge_id, and answer are required');
    }
    
    try {
      const result = await submitAnswer(serverUrl, challengeId, answer);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
        isError: !(result as any).success,
      };
    } catch (err) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ success: false, error: String(err) }, null, 2),
        }],
        isError: true,
      };
    }
  }

  throw new Error(`Unknown tool: ${name}`);
});

// Start
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('rcaptcha MCP skill v2.0 (two-call flow) running');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
