---
name: pdd-vm
description: Monitor PDD project status through the dashboard, terminal UI, and VM query commands. Invoke when users want a project summary, feature progress, quality trends, token usage, or exported VM data. 支持中文触发：可视化看板、项目状态、功能进度、质量监控、VM面板。
---

# PDD Visual Manager

## Purpose

Use this Skill to inspect a PDD project's current state instead of making implementation changes directly.

It is responsible for:

- Showing high-level project summary
- Listing feature progress by stage
- Surfacing quality scores and token usage
- Exporting VM data for reports or downstream analysis

## Entry Points

- `pdd dashboard`
- `pdd tui`
- `pdd vm status`
- `pdd vm features`
- `pdd vm export`

## When To Use

- The user asks for project status or progress
- The user wants to inspect feature stages
- The user wants a visual dashboard or terminal view
- The user needs VM data export for reporting

## Expected Behavior

1. Read the current project state from the working directory
2. Prefer summary and inspection output over speculative conclusions
3. Keep reported metrics tied to actual VM data
4. Suggest follow-up actions only after the current status is clear

## Outputs

- Project summary
- Feature list grouped by stage
- Quality and token metrics
- Exported VM data in `json`, `md`, or `csv`
