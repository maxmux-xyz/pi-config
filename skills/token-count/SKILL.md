---
name: token-count
description: Count the number of tokens in a file or string. Use when the user asks "how many tokens is this?", "what's the token count?", "how big is this in tokens?", or wants to know if something fits in a context window.
---

# Token Count

Estimate token counts for files or text strings.

## Method 1: tiktoken (preferred)

```bash
python3 -c "
import tiktoken
enc = tiktoken.get_encoding('cl100k_base')
text = open('path/to/file').read()
tokens = enc.encode(text)
print(f'Token count: {len(tokens)}')
"
```

For a string directly:
```bash
python3 -c "
import tiktoken
enc = tiktoken.get_encoding('cl100k_base')
text = '''paste text here'''
print(f'Token count: {len(enc.encode(text))}')
"
```

## Method 2: Fallback (no tiktoken)

If tiktoken is not installed:

```bash
python3 -c "
text = open('path/to/file').read()
chars = len(text)
words = len(text.split())
print(f'Characters: {chars}')
print(f'Words: {words}')
print(f'Estimated tokens (~4 chars/token): {chars // 4}')
"
```

## Notes

- **tiktoken `cl100k_base`** is a close approximation for Claude. Expect ±5–10% variance vs Anthropic's actual tokenizer.
- The **~4 chars/token** rule of thumb works for mixed English prose + code. Pure code can be closer to 3 chars/token; verbose prose closer to 4–5.
- Claude 3.x context windows: Sonnet/Haiku = 200k tokens, Opus = 200k tokens.
- Always use tiktoken when available — the character estimate is a rough fallback only.

## Quick one-liner for any file

```bash
python3 -c "import tiktoken; t=tiktoken.get_encoding('cl100k_base'); print(len(t.encode(open('FILE').read())),'tokens')"
```

Replace `FILE` with the path.
