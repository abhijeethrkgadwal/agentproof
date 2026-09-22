"use client";

import { useEffect, useRef, useState } from "react";
import type { NaturalChallengeRenderProps } from "@/components/agentproof/NaturalChallengeShell";
import type { InteractionSample } from "@/lib/challenge/core/types";

type BodyLayout = {
  id: string;
  role: string;
  color: string;
  width: number;
  height: number;
  start: { x: number; y: number };
  draggable: boolean;
};

export function PhysicalInteractionChallenge({
  challenge,
  interactive,
  onSamples,
  accessibleMode,
  onAccessibleSubmit,
}: NaturalChallengeRenderProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const layout = challenge.scene.layout as {
    platform: { x: number; y: number; width: number; height: number };
    bodies: BodyLayout[];
  };
  const [agent, setAgent] = useState(() => {
    const a = layout.bodies.find((b) => b.id === "agent")!;
    return {
      x: a.start.x + a.width / 2,
      y: a.start.y + a.height / 2,
    };
  });
  const [protectedPos, setProtectedPos] = useState(() => {
    const p = layout.bodies.find((b) => b.id === "protected")!;
    return { x: p.start.x, y: p.start.y, w: p.width, h: p.height };
  });
  const dragging = useRef(false);
  const samples = useRef<InteractionSample[]>([]);
  const count = useRef(0);
  const started = useRef(0);
  const [placement, setPlacement] = useState<string | null>(null);

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

      const plat = layout.platform;
      ctx.fillStyle = "#475569";
      ctx.fillRect(plat.x, plat.y, plat.width, plat.height);

      for (const b of layout.bodies) {
        if (b.id === "agent" || b.id === "protected") continue;
        ctx.fillStyle = b.color;
        ctx.fillRect(b.start.x, b.start.y, b.width, b.height);
      }

      ctx.fillStyle = "#3d8bfd";
      ctx.fillRect(protectedPos.x, protectedPos.y, protectedPos.w, protectedPos.h);

      const agentBody = layout.bodies.find((b) => b.id === "agent")!;
      ctx.fillStyle = "#e35d6a";
      ctx.fillRect(
        agent.x - agentBody.width / 2,
        agent.y - agentBody.height / 2,
        agentBody.width,
        agentBody.height,
      );

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [agent, challenge.scene, layout, protectedPos]);

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
    samples.current.push({ t, x, y, objectId: "agent", kind });
    if (samples.current.length > 800) samples.current = samples.current.slice(-600);
    count.current += 1;
    onSamples([...samples.current], count.current);
  };

  const resolvePush = (nx: number, ny: number) => {
    const agentBody = layout.bodies.find((b) => b.id === "agent")!;
    const ax = nx - agentBody.width / 2;
    const ay = ny - agentBody.height / 2;
    let px = protectedPos.x;
    let py = protectedPos.y;
    const aw = agentBody.width;
    const ah = agentBody.height;
    const overlapX =
      Math.min(ax + aw, px + protectedPos.w) - Math.max(ax, px);
    const overlapY =
      Math.min(ay + ah, py + protectedPos.h) - Math.max(ay, py);
    if (overlapX > 0 && overlapY > 0) {
      if (overlapX < overlapY) {
        px += nx < px + protectedPos.w / 2 ? overlapX : -overlapX;
      } else {
        py += ny < py + protectedPos.h / 2 ? overlapY : -overlapY;
      }
      setProtectedPos((p) => ({ ...p, x: px, y: py }));
    }
    setAgent({ x: nx, y: ny });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!interactive || accessibleMode) return;
    const p = toLocal(e.clientX, e.clientY);
    const agentBody = layout.bodies.find((b) => b.id === "agent")!;
    if (
      Math.abs(p.x - agent.x) > agentBody.width ||
      Math.abs(p.y - agent.y) > agentBody.height
    ) {
      return;
    }
    dragging.current = true;
    push(p.x, p.y, "down");
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const p = toLocal(e.clientX, e.clientY);
    resolvePush(p.x, p.y);
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
          Choose the safe platform placement for the red block. This does not
          require visual tracking or colour discrimination alone.
        </p>
        <div className="flex flex-wrap gap-2">
          {["left", "center", "right"].map((opt) => (
            <button
              key={opt}
              type="button"
              className={`rounded border px-3 py-2 text-sm capitalize ${
                placement === opt
                  ? "border-cyan-400 text-cyan-200"
                  : "border-slate-600 text-slate-100"
              }`}
              onClick={() => setPlacement(opt)}
            >
              {opt}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="rounded bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40"
          disabled={!placement}
          onClick={() => placement && onAccessibleSubmit({ placement })}
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
      data-testid="physical-canvas"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  );
}
