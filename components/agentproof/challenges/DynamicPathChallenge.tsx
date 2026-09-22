"use client";

import { useEffect, useRef, useState } from "react";
import type { NaturalChallengeRenderProps } from "@/components/agentproof/NaturalChallengeShell";
import type { InteractionSample } from "@/lib/challenge/core/types";

type GateLayout = {
  id: string;
  x: number;
  openingHeight: number;
  gateThickness: number;
};

const STEP = 24;
const BALL_R = 16;

export function DynamicPathChallenge({
  challenge,
  poses,
  interactive,
  elapsedMs,
  onSamples,
  accessibleMode,
}: NaturalChallengeRenderProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const layout = challenge.scene.layout as {
    ballStart: { x: number; y: number };
    goalX: number;
    gates: GateLayout[];
  };
  const [ball, setBall] = useState(layout.ballStart);
  const dragging = useRef(false);
  const samples = useRef<InteractionSample[]>([]);
  const count = useRef(0);
  const clockRef = useRef({ baseElapsed: 0, basePerf: 0 });
  const ballRef = useRef(ball);
  useEffect(() => {
    clockRef.current = { baseElapsed: elapsedMs, basePerf: performance.now() };
  }, [elapsedMs]);
  useEffect(() => {
    ballRef.current = ball;
  }, [ball]);
  const push = (x: number, y: number, kind: InteractionSample["kind"]) => {
    samples.current.push({ t: (() => { const c = clockRef.current; return Math.max(0, c.baseElapsed + (performance.now() - c.basePerf)); })(), x, y, objectId: "ball", kind });
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

      ctx.strokeStyle = "#20c997";
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(layout.goalX, 0);
      ctx.lineTo(layout.goalX, height);
      ctx.stroke();
      ctx.setLineDash([]);

      for (const gate of layout.gates) {
        const opening = poses.find((p) => p.id === `${gate.id}_opening`);
        const center = opening?.y ?? height / 2;
        const half = gate.openingHeight / 2;
        ctx.fillStyle = "#64748b";
        ctx.fillRect(
          gate.x - gate.gateThickness / 2,
          0,
          gate.gateThickness,
          Math.max(0, center - half),
        );
        ctx.fillRect(
          gate.x - gate.gateThickness / 2,
          center + half,
          gate.gateThickness,
          Math.max(0, height - (center + half)),
        );
        ctx.strokeStyle = "#22d3ee";
        ctx.strokeRect(
          gate.x - gate.gateThickness / 2,
          center - half,
          gate.gateThickness,
          gate.openingHeight,
        );
      }

      const b = ballRef.current;
      ctx.beginPath();
      ctx.fillStyle = "#ffc107";
      ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
      ctx.fill();

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [accessibleMode, challenge.scene, layout, poses]);

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
    if (Math.hypot(p.x - ball.x, p.y - ball.y) > 28) return;
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    push(p.x, p.y, "down");
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const p = toLocal(e.clientX, e.clientY);
    setBall(p);
    push(p.x, p.y, "move");
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    const p = toLocal(e.clientX, e.clientY);
    push(p.x, p.y, "up");
  };

  const nudge = (dx: number, dy: number) => {
    if (!interactive) return;
    const next = {
      x: Math.min(
        challenge.scene.width - BALL_R,
        Math.max(BALL_R, ball.x + dx),
      ),
      y: Math.min(
        challenge.scene.height - BALL_R,
        Math.max(BALL_R, ball.y + dy),
      ),
    };
    setBall(next);
    push(next.x, next.y, "move");
  };

  const openings = poses.filter((p) => p.role === "opening");
  const live = [
    `Ball at ${Math.round(ball.x)}, ${Math.round(ball.y)}.`,
    `Goal line at x=${layout.goalX}.`,
    ...openings.map(
      (o) =>
        `Opening ${o.id.replace("_opening", "")} center y=${Math.round(o.y)}.`,
    ),
  ].join(" ");

  if (accessibleMode) {
    return (
      <div className="space-y-4 rounded-md border border-slate-800 bg-slate-950/50 p-4">
        <p className="text-slate-300">
          Nudge the ball through each moving opening to the goal line. Opening
          centers are announced from live server frames.
        </p>
        <p className="sr-only" aria-live="polite">
          {live}
        </p>
        <p className="font-mono text-xs text-slate-400">{live}</p>
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
              className="rounded border border-slate-600 px-3 py-2 text-sm text-slate-100"
              onClick={() => nudge(dx, dy)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={challenge.scene.width}
      height={challenge.scene.height}
      className="w-full max-w-full touch-none rounded-md border border-slate-700/80"
      data-testid="dynamic-path-canvas"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  );
}
