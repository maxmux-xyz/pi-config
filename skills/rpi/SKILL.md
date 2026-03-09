---
name: rpi
description: Research-Plan-Implement workflow for solving hard problems in complex codebases. Use when implementing features, fixing bugs, or making any non-trivial changes. Prevents AI "slop" by forcing deliberate understanding before coding.
---

# RPI Skill: Research → Plan → Implement

A disciplined workflow for solving hard problems in complex codebases without generating slop.

---

## Why RPI Matters

### The Problem: AI Slop in Brownfield Codebases

Standard AI coding works great for greenfield projects. But in complex, legacy codebases it produces **slop**—code that looks reasonable but:
- Misunderstands existing patterns and conventions
- Duplicates functionality that already exists
- Ignores edge cases the codebase already handles
- Creates inconsistencies that require extensive rework

### The Cause: The Dumb Zone

LLM performance degrades when context windows fill with noise:
- File exploration and search results
- Failed attempts and error messages
- Test output and build logs
- Back-and-forth corrections

Around 40% context utilization, you enter the "dumb zone" where reasoning quality drops sharply.

### The Solution: Separate Phases

RPI keeps context clean by **separating exploration from implementation**:

1. **Research** in a fresh context → understand the system
2. **Plan** with that understanding → get human alignment
3. **Implement** from a clear plan → write correct code

This prevents hallucinated logic and ensures the human understands what's changing and why.

---

## The RPI Workflow

### Phase 1: Research 🔍

**Goal**: Gather facts. Understand the system before changing it.

**Actions**:
- Read existing code in the relevant areas
- Find similar patterns already in the codebase
- Understand data flow and dependencies
- Identify tests that cover this area
- Check for existing utilities that could be reused

**Critical questions to answer**:
- How does this codebase already solve similar problems?
- What patterns and conventions are established?
- What would break if I make this change?
- What existing code can I reuse or extend?

**Output**: Mental model of the relevant system. Key files and patterns identified.

**Rules**:
- DO NOT write any implementation code yet
- DO NOT make assumptions—find the actual code
- DO search broadly—you don't know what you don't know
- DO note specific file paths and line numbers

---

### Phase 2: Plan 📝

**Goal**: Create a human-reviewable plan before writing code.

**The plan should include**:

1. **Summary**: One sentence describing what you're implementing
2. **Approach**: How you'll solve it (referencing patterns found in Research)
3. **Files to modify**: List each file with a brief description of changes
4. **Files to create**: Any new files needed
5. **Dependencies**: Other systems affected, tests to update
6. **Edge cases**: Explicitly call out how you'll handle them
7. **Open questions**: Anything you're uncertain about

**Example plan format**:

```markdown
## Summary
Add rate limiting to the /api/findings endpoint.

## Approach
Use the existing RateLimiter from utils/rate_limit.py (found during research).
Follow the pattern used in /api/reports (see server/routes/reports.py:45).

## Files to modify
- server/routes/findings.py - Add rate limit decorator
- server/routes/__init__.py - Import rate limiter
- tests/routes/test_findings.py - Add rate limit tests

## Edge cases
- Authenticated vs anonymous users: Use different limits per existing pattern
- Burst handling: Leverage existing token bucket implementation

## Open questions
- None - pattern is clear from existing usage
```

**Present the plan to the user and wait for approval before proceeding.**

---

### Phase 3: Implement ⚡

**Goal**: Execute the plan. Write correct code on the first attempt.

**Rules**:
- Follow the plan exactly—no scope creep
- Reference the patterns you found in Research
- Match existing code style and conventions
- Write tests alongside implementation
- If you discover the plan is wrong, STOP and re-plan

**Implementation checklist**:
- [ ] Changes match the plan
- [ ] Code follows established patterns from Research
- [ ] No duplicated functionality
- [ ] Tests cover the new code
- [ ] Linting passes

**If things go wrong**:
- Stop implementing
- Note what's different from the plan
- Return to Planning phase with new information
- Do NOT improvise fixes that weren't in the plan

---

## When to Use RPI

**Always use RPI for**:
- Features touching multiple files
- Bug fixes in unfamiliar code
- Changes to core business logic
- Anything involving database schemas
- API changes

**Can skip RPI for**:
- Typo fixes
- Simple config changes
- Adding tests for existing code
- Documentation updates

**When in doubt, use RPI.** The 5 minutes spent researching and planning saves hours of rework.

---

## Anti-Patterns to Avoid

❌ **Jumping straight to code** - "Let me just implement this real quick"
❌ **Assuming patterns** - "This probably works like X"
❌ **Planning without research** - Plans built on assumptions fail
❌ **Scope creep during implementation** - "While I'm here, I'll also..."
❌ **Ignoring existing code** - Duplicating what's already there
❌ **Skipping human review** - The plan enables mental alignment

---

## Quick Reference

| Phase | Duration | Output | Stop When |
|-------|----------|--------|-----------|
| Research | 5-15 min | Mental model, key files identified | You understand the system |
| Plan | 5-10 min | Written plan with files and approach | Human approves the plan |
| Implement | Variable | Working code with tests | Plan is complete |

---

## Remember

> "AI amplifies both thinking and lack of thinking."

The time invested in Research and Planning is never wasted. It's the difference between shipping confidently and spending the next week reworking AI slop.

**Research. Plan. Implement. In that order. Every time.**
