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

export function DynamicPathChallenge({
  challenge,
  poses,
  interactive,
  onSamples,
  accessibleMode,
  onAccessibleSubmit,
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
  const started = useRef(0);
  const [slots, setSlots] = useState<number[]>([]);

  useEffect(() => {
    started.current = performance.now();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width, height } = challenge.scene;
    let raf = 0;
    const loop = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#0b1220";
      ctx.fillRect(0, 0, width, height);

      // Goal line
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
        // top wall
        ctx.fillRect(
          gate.x - gate.gateThickness / 2,
          0,
          gate.gateThickness,
          Math.max(0, center - half),
        );
        // bottom wall
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

      ctx.beginPath();
      ctx.fillStyle = "#ffc107";
      ctx.arc(ball.x, ball.y, 16, 0, Math.PI * 2);
      ctx.fill();

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [ball, challenge.scene, layout, poses]);

  const toLocal = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) * challenge.scene.width) / rect.width,
      y: ((clientY - rect.top) * challenge.scene.height) / rect.height,
    };
  };

  const push = (x: number, y: number, kind: InteractionSample["kind"]) => {
    const t = performance.now() - started.current;
    samples.current.push({ t, x, y, objectId: "ball", kind });
    if (samples.current.length > 800) samples.current = samples.current.slice(-600);
    count.current += 1;
    onSamples([...samples.current], count.current);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!interactive || accessibleMode) return;
    const p = toLocal(e.clientX, e.clientY);
    if (Math.hypot(p.x - ball.x, p.y - ball.y) > 28) return;
    dragging.current = true;
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

  if (accessibleMode) {
    return (
      <div className="space-y-4 rounded-md border border-slate-800 bg-slate-950/50 p-4">
        <p className="text-slate-300">
          For each gate, pick opening slot 0 (top), 1 (middle), or 2 (bottom).
          No continuous tracking required.
        </p>
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2].map((slot) => (
            <button
              key={slot}
              type="button"
              className="rounded border border-slate-600 px-3 py-2 text-sm text-slate-100"
              onClick={() => setSlots((s) => [...s, slot])}
            >
              Slot {slot}
            </button>
          ))}
          <button
            type="button"
            className="rounded border border-slate-700 px-3 py-2 text-sm text-slate-400"
            onClick={() => setSlots([])}
          >
            Clear
          </button>
        </div>
        <p className="font-mono text-sm text-cyan-300">
          {slots.length ? slots.join(", ") : "—"}
        </p>
        <button
          type="button"
          className="rounded bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950"
          onClick={() => onAccessibleSubmit({ slots: slots.join(",") })}
        >
          Lock accessible answer
        </button>
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
