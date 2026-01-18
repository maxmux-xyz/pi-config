#!/usr/bin/env node
/**
 * Export pi session history to markdown files in Obsidian vault
 */

import { readFileSync, readdirSync, writeFileSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';

const SESSIONS_DIR = '/Users/maxime/.pi/agent/sessions';
const OUTPUT_DIR = '/Users/maxime/dev/obsidianvault/prompts';

function extractTextContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('\n');
  }
  return '';
}

function processSession(sessionPath) {
  const lines = readFileSync(sessionPath, 'utf8').trim().split('\n');
  const conversations = [];
  let currentConversation = null;
  let header = null;
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    try {
      const entry = JSON.parse(line);
      
      if (entry.type === 'session') {
        header = entry;
        continue;
      }
      
      if (entry.type === 'message' && entry.message) {
        const { role, content } = entry.message;
        
        if (role === 'user') {
          // Start new conversation
          const text = extractTextContent(content);
          if (text.trim()) {
            currentConversation = {
              timestamp: entry.timestamp,
              userPrompt: text,
              assistantResponse: '',
              cwd: header?.cwd || 'unknown'
            };
          }
        } else if (role === 'assistant' && currentConversation) {
          // Add to assistant response (only text, not tool calls)
          const text = extractTextContent(content);
          if (text.trim()) {
            if (currentConversation.assistantResponse) {
              currentConversation.assistantResponse += '\n\n';
            }
            currentConversation.assistantResponse += text;
          }
        }
        
        // When we see a new user message after having a response, save the previous conversation
        if (role === 'user' && conversations.length > 0) {
          const last = conversations[conversations.length - 1];
          if (!last.assistantResponse && currentConversation !== last) {
            conversations.pop(); // Remove incomplete conversation
          }
        }
        
        if (role === 'user' && currentConversation && currentConversation.userPrompt) {
          conversations.push(currentConversation);
        }
      }
    } catch (e) {
      // Skip malformed lines
    }
  }
  
  return conversations;
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  return date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function formatDateReadable(timestamp) {
  return new Date(timestamp).toLocaleString();
}

function projectNameFromCwd(cwd) {
  if (!cwd) return 'unknown';
  const parts = cwd.split('/');
  return parts[parts.length - 1] || parts[parts.length - 2] || 'unknown';
}

// Find all session directories and files
const sessionDirs = readdirSync(SESSIONS_DIR).filter(d => {
  const path = join(SESSIONS_DIR, d);
  return statSync(path).isDirectory();
});

let totalConversations = 0;

for (const dir of sessionDirs) {
  const dirPath = join(SESSIONS_DIR, dir);
  const files = readdirSync(dirPath).filter(f => f.endsWith('.jsonl'));
  
  for (const file of files) {
    const sessionPath = join(dirPath, file);
    const conversations = processSession(sessionPath);
    
    for (const conv of conversations) {
      if (!conv.userPrompt || !conv.assistantResponse) continue;
      
      const project = projectNameFromCwd(conv.cwd);
      const dateStr = formatDate(conv.timestamp);
      const filename = `${dateStr}-${project}.md`;
      const filepath = join(OUTPUT_DIR, filename);
      
      const content = `---
date: ${conv.timestamp}
project: ${project}
path: ${conv.cwd}
---

# ${formatDateReadable(conv.timestamp)}

## Prompt

${conv.userPrompt}

## Response

${conv.assistantResponse}
`;
      
      writeFileSync(filepath, content, 'utf8');
      totalConversations++;
    }
  }
}

console.log(`Exported ${totalConversations} conversations to ${OUTPUT_DIR}`);
