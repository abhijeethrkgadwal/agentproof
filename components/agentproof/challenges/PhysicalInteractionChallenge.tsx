"use client";

import { useEffect, useRef, useState } from "react";
import type { NaturalChallengeRenderProps } from "@/components/agentproof/NaturalChallengeShell";
import { clientSampleTimeMs } from "@/lib/challenge/clientClock";
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

const STEP = 24;

export function PhysicalInteractionChallenge({
  challenge,
  interactive,
  serverStartedAtMs,
  onSamples,
  accessibleMode,
  onGoalReached,
}: NaturalChallengeRenderProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const layout = challenge.scene.layout as {
    platform: { x: number; y: number; width: number; height: number };
    bodies: BodyLayout[];
  };
  const agentBody = layout.bodies.find((b) => b.id === "agent")!;
  const [agent, setAgent] = useState(() => ({
    x: agentBody.start.x + agentBody.width / 2,
    y: agentBody.start.y + agentBody.height / 2,
  }));
  const protectedPos = useRef(
    (() => {
      const p = layout.bodies.find((b) => b.id === "protected")!;
      return { x: p.start.x, y: p.start.y, w: p.width, h: p.height };
    })(),
  );
  const [protAnnounce, setProtAnnounce] = useState(() => {
    const p = layout.bodies.find((b) => b.id === "protected")!;
    return { x: p.start.x, y: p.start.y, w: p.width, h: p.height };
  });
  const dragging = useRef(false);
  const samples = useRef<InteractionSample[]>([]);
  const count = useRef(0);
  const agentRef = useRef(agent);
  const goalFired = useRef(false);

  useEffect(() => {
    agentRef.current = agent;
  }, [agent]);

  const sampleTime = () => clientSampleTimeMs(serverStartedAtMs);

  const checkGoal = (ax: number, ay: number) => {
    if (goalFired.current || !onGoalReached) return;
    const plat = layout.platform;
    if (
      ax >= plat.x &&
      ax <= plat.x + plat.width &&
      ay >= plat.y &&
      ay <= plat.y + plat.height
    ) {
      goalFired.current = true;
      onGoalReached();
    }
  };

  const push = (x: number, y: number, kind: InteractionSample["kind"]) => {
    samples.current.push({
      t: sampleTime(),
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
    checkGoal(x, y);
  };

  const resolvePush = (nx: number, ny: number) => {
    const ax = nx - agentBody.width / 2;
    const ay = ny - agentBody.height / 2;
    const prot = protectedPos.current;
    let px = prot.x;
    let py = prot.y;
    const aw = agentBody.width;
    const ah = agentBody.height;
    const overlapX = Math.min(ax + aw, px + prot.w) - Math.max(ax, px);
    const overlapY = Math.min(ay + ah, py + prot.h) - Math.max(ay, py);
    if (overlapX > 0 && overlapY > 0) {
      if (overlapX < overlapY) {
        px += nx < px + prot.w / 2 ? overlapX : -overlapX;
      } else {
        py += ny < py + prot.h / 2 ? overlapY : -overlapY;
      }
      protectedPos.current = { ...prot, x: px, y: py };
      setProtAnnounce({ ...prot, x: px, y: py });
    }
    setAgent({ x: nx, y: ny });
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

      const plat = layout.platform;
      ctx.fillStyle = "#475569";
      ctx.fillRect(plat.x, plat.y, plat.width, plat.height);

      for (const b of layout.bodies) {
        if (b.id === "agent" || b.id === "protected") continue;
        ctx.fillStyle = b.color;
        ctx.fillRect(b.start.x, b.start.y, b.width, b.height);
      }

      const prot = protectedPos.current;
      ctx.fillStyle = "#3d8bfd";
      ctx.fillRect(prot.x, prot.y, prot.w, prot.h);

      const a = agentRef.current;
      ctx.fillStyle = "#e35d6a";
      ctx.fillRect(
        a.x - agentBody.width / 2,
        a.y - agentBody.height / 2,
        agentBody.width,
        agentBody.height,
      );

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [accessibleMode, agentBody, challenge.scene, layout]);

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
    if (
      Math.abs(p.x - agent.x) > agentBody.width ||
      Math.abs(p.y - agent.y) > agentBody.height
    ) {
      return;
    }
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
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

  const nudge = (dx: number, dy: number) => {
    if (!interactive) return;
    const next = { x: agent.x + dx, y: agent.y + dy };
    resolvePush(next.x, next.y);
    push(next.x, next.y, "move");
  };

  const live = `Red block at ${Math.round(agent.x)}, ${Math.round(agent.y)}. Blue block at ${Math.round(protAnnounce.x + protAnnounce.w / 2)}, ${Math.round(protAnnounce.y + protAnnounce.h / 2)}. Platform x ${layout.platform.x}-${layout.platform.x + layout.platform.width}.`;

  if (accessibleMode) {
    return (
      <div className="space-y-4 rounded-md border border-slate-800 bg-slate-950/50 p-4">
        <p className="text-slate-300">
          Nudge the red block onto the platform without pushing the blue block
          off. Positions are announced from the live scene.
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
      data-testid="physical-canvas"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  );
}
