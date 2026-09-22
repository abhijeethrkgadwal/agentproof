"use client";

import { useEffect, useRef, useState } from "react";
import type { NaturalChallengeRenderProps } from "@/components/agentproof/NaturalChallengeShell";
import type { InteractionSample } from "@/lib/challenge/core/types";

export function DragAvoidChallenge({
  challenge,
  poses,
  interactive,
  onSamples,
  accessibleMode,
  onAccessibleSubmit,
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
  const started = useRef(0);
  const [corridor, setCorridor] = useState<string[]>([]);

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

      ctx.beginPath();
      ctx.fillStyle = "#3d8bfd";
      ctx.arc(agent.x, agent.y, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#f8fafc";
      ctx.lineWidth = 2;
      ctx.stroke();

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [agent, challenge.scene, poses]);

  const toLocal = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) * challenge.scene.width) / rect.width,
      y: ((clientY - rect.top) * challenge.scene.height) / rect.height,
    };
  };

  const pushSample = (x: number, y: number, kind: InteractionSample["kind"]) => {
    const t = performance.now() - started.current;
    samples.current.push({ t, x, y, objectId: "agent", kind });
    if (samples.current.length > 800) {
      samples.current = samples.current.slice(-600);
    }
    count.current += 1;
    onSamples([...samples.current], count.current);
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

  if (accessibleMode) {
    const options = ["north", "center", "south"];
    return (
      <div className="space-y-4 rounded-md border border-slate-800 bg-slate-950/50 p-4">
        <p className="text-slate-300">
          Choose a safe corridor sequence (one step per obstacle). This is a
          structured equivalent — not colour- or drag-dependent.
        </p>
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              className="rounded border border-slate-600 px-3 py-2 text-sm capitalize text-slate-100 hover:border-cyan-400"
              onClick={() => setCorridor((c) => [...c, opt])}
            >
              {opt}
            </button>
          ))}
          <button
            type="button"
            className="rounded border border-slate-700 px-3 py-2 text-sm text-slate-400"
            onClick={() => setCorridor([])}
          >
            Clear
          </button>
        </div>
        <p className="font-mono text-sm text-cyan-300">{corridor.join(" → ") || "—"}</p>
        <button
          type="button"
          className="rounded bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950"
          onClick={() => onAccessibleSubmit({ path: corridor.join(",") })}
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
      data-testid="drag-avoid-canvas"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  );
}
