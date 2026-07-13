import Anthropic from '@anthropic-ai/sdk';
import { getSetting } from '../db.js';

// Provider selection: admin Settings picks anthropic (Claude Haiku) or openai
// (GPT-4o-mini); a provider is only usable if its key is in the server env.
// Keys live in env vars only — never in the DB, never sent to clients.

const ANTHROPIC_MODEL = 'claude-haiku-4-5';
const OPENAI_MODEL = 'gpt-4o-mini';

let anthropicClient = null;
function anthropic() {
  if (!anthropicClient) anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return anthropicClient;
}

export async function activeProvider() {
  const pref = await getSetting('ai_provider');
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasOpenai = !!process.env.OPENAI_API_KEY;
  if (pref === 'anthropic' && hasAnthropic) return 'anthropic';
  if (pref === 'openai' && hasOpenai) return 'openai';
  if (hasAnthropic) return 'anthropic';
  if (hasOpenai) return 'openai';
  return null; // callers fall back to their mock
}

export function maskedKey(provider) {
  const key = provider === 'openai' ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY;
  if (!key) return '';
  return '••••' + key.slice(-4);
}

/**
 * Run a chat with server-executed tools until the model produces a final reply.
 * tools: [{ name, description, input_schema, run(input) -> string }]
 * messages: [{ role: 'user'|'assistant', content: string }]
 * Returns the assistant's final text, or null when no provider is configured.
 */
export async function chatWithTools({ system, messages, tools = [], maxTokens = 700 }) {
  const provider = await activeProvider();
  if (!provider) return null;
  if (provider === 'anthropic') return anthropicChat({ system, messages, tools, maxTokens });
  return openaiChat({ system, messages, tools, maxTokens });
}

async function anthropicChat({ system, messages, tools, maxTokens }) {
  const client = anthropic();
  const toolDefs = tools.map(({ name, description, input_schema }) => ({ name, description, input_schema }));
  let msgs = messages.map((m) => ({ role: m.role, content: m.content }));

  for (let turn = 0; turn < 6; turn++) {
    const response = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      system,
      tools: toolDefs.length ? toolDefs : undefined,
      messages: msgs
    });

    if (response.stop_reason === 'tool_use') {
      msgs.push({ role: 'assistant', content: response.content });
      const results = [];
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;
        const tool = tools.find((t) => t.name === block.name);
        try {
          const out = tool ? await tool.run(block.input || {}) : `No tool named ${block.name}`;
          results.push({ type: 'tool_result', tool_use_id: block.id, content: String(out) });
        } catch (e) {
          results.push({ type: 'tool_result', tool_use_id: block.id, content: `Error: ${e.message}`, is_error: true });
        }
      }
      msgs.push({ role: 'user', content: results });
      continue;
    }

    return response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
  }
  return 'Sorry, I got stuck — try rephrasing that?';
}

async function openaiChat({ system, messages, tools, maxTokens }) {
  const toolDefs = tools.map(({ name, description, input_schema }) => ({
    type: 'function',
    function: { name, description, parameters: input_schema }
  }));
  let msgs = [{ role: 'system', content: system }, ...messages.map((m) => ({ role: m.role, content: m.content }))];

  for (let turn = 0; turn < 6; turn++) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        max_tokens: maxTokens,
        messages: msgs,
        tools: toolDefs.length ? toolDefs : undefined
      })
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    const choice = data.choices[0];

    if (choice.finish_reason === 'tool_calls' || choice.message.tool_calls?.length) {
      msgs.push(choice.message);
      for (const call of choice.message.tool_calls) {
        const tool = tools.find((t) => t.name === call.function.name);
        let content;
        try {
          const input = JSON.parse(call.function.arguments || '{}');
          content = tool ? String(await tool.run(input)) : `No tool named ${call.function.name}`;
        } catch (e) {
          content = `Error: ${e.message}`;
        }
        msgs.push({ role: 'tool', tool_call_id: call.id, content });
      }
      continue;
    }

    return (choice.message.content || '').trim();
  }
  return 'Sorry, I got stuck — try rephrasing that?';
}

/** One-shot text generation (campaign copy). Returns null when no provider. */
export async function generateText({ system, prompt, maxTokens = 300 }) {
  const provider = await activeProvider();
  if (!provider) return null;
  if (provider === 'anthropic') {
    const response = await anthropic().messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: prompt }]
    });
    return response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
  }
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt }
      ]
    })
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const data = await res.json();
  return (data.choices[0].message.content || '').trim();
}
