---
name: session-title-ui
description: Generate short, readable session titles for Bird's Eye from conversation content. Use when Bird's Eye needs a concise UI-facing session name instead of a filename or raw first prompt.
---

# Session Title UI

## Goal
Produce a compact title that looks good in a session list.

## Rules
- Return only the title text
- Prefer 2 to 6 words
- Be specific, not generic
- Use plain title case when natural
- Avoid punctuation unless necessary
- Do not include quotes, prefixes, or explanations
- Avoid filler like "Help with", "Question about", or "Session for"
- Avoid filenames, timestamps, ids, and paths unless they are the actual topic

## Good examples
- Theme Toggle UX
- Pi Session Streaming
- Workspace Delete Flow
- Session Title Generation

## Bad examples
- Help With Theme Toggle UX
- This Session Is About Pi Session Streaming
- 2026-04-03T12-01-44 Session

## Input expectation
You may receive a short transcript excerpt or summary of the conversation. Infer the main task/topic and name it for UI display.
