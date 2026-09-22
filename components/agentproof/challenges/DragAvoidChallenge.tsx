"use client";

import { useEffect, useRef, useState } from "react";
import type { NaturalChallengeRenderProps } from "@/components/agentproof/NaturalChallengeShell";
import type { InteractionSample } from "@/lib/challenge/core/types";

const AGENT_R = 18;
const STEP = 28;

export function DragAvoidChallenge({
  challenge,
  poses,
  interactive,
  elapsedMs,
  onSamples,
  accessibleMode,
}: NaturalChallengeRenderProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [agent, setAgent] = useState(() => {
    const layout = challenge.scene.layout as
      | { agentStart?: { x: number; y: number } }
      | undefined;
    return layout?.agentStart ?? { x: 70, y: 180 };
  });
  const dragging = useRef(false);
  const samples = useRef<InteractionSample[]>([]);
  const count = useRef(0);
  const clockRef = useRef({ baseElapsed: 0, basePerf: 0 });
  const agentRef = useRef(agent);
  useEffect(() => {
    clockRef.current = { baseElapsed: elapsedMs, basePerf: performance.now() };
  }, [elapsedMs]);
  useEffect(() => {
    agentRef.current = agent;
  }, [agent]);
  const pushSample = (x: number, y: number, kind: InteractionSample["kind"]) => {
    samples.current.push({
      t: (() => { const c = clockRef.current; return Math.max(0, c.baseElapsed + (performance.now() - c.basePerf)); })(),
      x,
      y,
      objectId: "agent",
      kind,
    });
    if (samples.current.length > 800) {
      samples.current = samples.current.slice(-600);
    }
    count.current += 1;
    onSamples([...samples.current], count.current);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || accessibleMode) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width, height } = challenge.scene;

    let raf = 0;
    const loop = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#0b1220";
      ctx.fillRect(0, 0, width, height);

      const target = poses.find((p) => p.role === "target" || p.id === "target");
      if (target) {
        ctx.beginPath();
        ctx.fillStyle = target.color;
        ctx.globalAlpha = 0.35;
        ctx.arc(target.x, target.y, target.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = target.color;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      for (const pose of poses) {
        if (pose.role === "obstacle" || pose.id.startsWith("obstacle_")) {
          ctx.beginPath();
          ctx.fillStyle = pose.color;
          ctx.arc(pose.x, pose.y, pose.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const a = agentRef.current;
      ctx.beginPath();
      ctx.fillStyle = "#3d8bfd";
      ctx.arc(a.x, a.y, AGENT_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#f8fafc";
      ctx.lineWidth = 2;
      ctx.stroke();

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [accessibleMode, challenge.scene, poses]);

  const toLocal = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) * challenge.scene.width) / rect.width,
      y: ((clientY - rect.top) * challenge.scene.height) / rect.height,
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!interactive || accessibleMode) return;
    const p = toLocal(e.clientX, e.clientY);
    if (Math.hypot(p.x - agent.x, p.y - agent.y) > 36) return;
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    pushSample(p.x, p.y, "down");
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const p = toLocal(e.clientX, e.clientY);
    setAgent(p);
    pushSample(p.x, p.y, "move");
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    const p = toLocal(e.clientX, e.clientY);
    pushSample(p.x, p.y, "up");
  };

  const nudge = (dx: number, dy: number) => {
    if (!interactive) return;
    const next = {
      x: Math.min(
        challenge.scene.width - AGENT_R,
        Math.max(AGENT_R, agent.x + dx),
      ),
      y: Math.min(
        challenge.scene.height - AGENT_R,
        Math.max(AGENT_R, agent.y + dy),
      ),
    };
    setAgent(next);
    pushSample(next.x, next.y, "move");
  };

  const obstacles = poses.filter(
    (p) => p.role === "obstacle" || p.id.startsWith("obstacle_"),
  );
  const target = poses.find((p) => p.role === "target" || p.id === "target");
  const live = [
    `Agent at ${Math.round(agent.x)}, ${Math.round(agent.y)}.`,
    target
      ? `Target at ${Math.round(target.x)}, ${Math.round(target.y)}.`
      : null,
    ...obstacles.map(
      (o) => `Obstacle ${o.id} at ${Math.round(o.x)}, ${Math.round(o.y)}.`,
    ),
  ]
    .filter(Boolean)
    .join(" ");

  if (accessibleMode) {
    return (
      <div className="space-y-4 rounded-md border border-slate-800 bg-slate-950/50 p-4">
        <p className="text-slate-300">
          Use discrete moves to reach the green target while avoiding obstacles.
          Live positions update from the server (no secret codes).
        </p>
        <p className="sr-only" aria-live="polite">
          {live}
        </p>
        <p className="font-mono text-xs text-slate-400" aria-hidden>
          {live}
        </p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["Up", 0, -STEP],
              ["Down", 0, STEP],
              ["Left", -STEP, 0],
              ["Right", STEP, 0],
            ] as const
          ).map(([label, dx, dy]) => (
            <button
              key={label}
              type="button"
              className="rounded border border-slate-600 px-3 py-2 text-sm text-slate-100 hover:border-cyan-400"
              onClick={() => nudge(dx, dy)}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-sm text-slate-400">
          Position: {Math.round(agent.x)}, {Math.round(agent.y)}
        </p>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={challenge.scene.width}
      height={challenge.scene.height}
      className="w-full max-w-full touch-none rounded-md border border-slate-700/80"
      data-testid="drag-avoid-canvas"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  );
}
