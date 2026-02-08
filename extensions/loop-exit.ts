/**
 * Loop Control Extension
 *
 * Provides tools for the agent to control pi-loop flow:
 *   loop_next      - End iteration, loop continues with next iteration
 *   loop_done      - Task complete, loop stops (writes DONE file)
 *   loop_terminate - Blocked/needs help, loop stops (writes EXIT file, releases lock)
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import * as fs from "node:fs";
import * as path from "node:path";

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "loop_next",
    label: "Loop Next",
    description:
      "End the current iteration. The loop will restart you with fresh context. " +
      "Use this when you've completed a chunk of work but the task isn't finished yet.",
    parameters: Type.Object({
      summary: Type.String({ description: "What you accomplished this iteration" }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      ctx.shutdown();
      return {
        content: [{ type: "text", text: `Next iteration: ${params.summary}` }],
        details: {},
      };
    },
  });

  pi.registerTool({
    name: "loop_done",
    label: "Loop Done",
    description:
      "Task is complete. Writes DONE file and stops the loop. " +
      "Only call this when ALL requirements in instruction.md are met.",
    parameters: Type.Object({
      taskDir: Type.String({ description: "Path to the task directory (where instruction.md is)" }),
      summary: Type.String({ description: "Summary of what was accomplished" }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const donePath = path.join(params.taskDir, "DONE");
      fs.writeFileSync(donePath, params.summary, "utf-8");
      ctx.shutdown();
      return {
        content: [{ type: "text", text: `✅ Task complete: ${params.summary}` }],
        details: {},
      };
    },
  });

  pi.registerTool({
    name: "loop_terminate",
    label: "Loop Terminate",
    description:
      "Stop the loop — you are blocked and need human help. Writes EXIT file with the reason. " +
      "Use when: stuck on an error, need human review, missing permissions, or task is unclear. " +
      "The lock will be released so other agents skip this task.",
    parameters: Type.Object({
      taskDir: Type.String({ description: "Path to the task directory (where instruction.md is)" }),
      reason: Type.String({ description: "Why you're blocked and what help is needed" }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const exitPath = path.join(params.taskDir, "EXIT");
      fs.writeFileSync(exitPath, params.reason, "utf-8");
      ctx.shutdown();
      return {
        content: [{ type: "text", text: `⏸️ Terminated: ${params.reason}` }],
        details: {},
      };
    },
  });
}
