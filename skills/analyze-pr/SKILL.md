---
name: analyze-pr
description: Analyze a PR - what it does, how it fits in the codebase, logic changes, and flag suspicious code
allowed-tools: Bash(gh:*), Bash(git:*), Read, Glob, Grep, Task
---

Analyze PR #$ARGUMENTS in the current repository.

## Your Task

You are a senior code reviewer. Provide a comprehensive analysis of this PR covering:

### 1. PR Overview
- Fetch PR details: `gh pr view $ARGUMENTS --json title,body,author,state,baseRefName,headRefName,files,additions,deletions`
- Fetch the diff: `gh pr diff $ARGUMENTS`
- Summarize what the PR is trying to accomplish

### 2. Files Changed
- List all files modified, added, or deleted
- Categorize them (e.g., source code, tests, config, docs)

### 3. Codebase Context
- Explain how the changed files fit into the broader codebase architecture
- Identify what parts of the application are affected
- Note any dependencies or downstream effects

### 4. Logic & Behavior Changes
- Describe the actual logic changes in detail
- Explain what application behavior is modified
- Highlight any breaking changes or API modifications
- Note changes to error handling, edge cases, or validation

### 5. Security & Suspicious Code Review
Flag anything that looks suspicious or concerning:
- Hardcoded secrets, API keys, or credentials
- Suspicious URLs or external endpoints
- Overly permissive permissions or access controls
- SQL injection, XSS, or other vulnerability patterns
- Obfuscated or unnecessarily complex code
- Unexpected file access or system calls
- Dependencies added without clear justification
- Code that doesn't match the stated PR purpose
- Backdoors or data exfiltration patterns
- Disabled security features or logging

### 6. Summary
- Overall assessment of the PR
- Key concerns if any
- Recommendation (approve/request changes/needs discussion)

## Output Format

Structure your analysis with clear headers and bullet points. Be specific and cite line numbers when discussing code. If you find nothing suspicious, explicitly state that the security review found no concerns.
