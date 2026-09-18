"use client";

import { useEffect, useRef } from "react";
import type { ObjectPose, PublicScene } from "@/lib/challenge/types";

function drawShape(
  ctx: CanvasRenderingContext2D,
  pose: ObjectPose,
  selected: boolean,
) {
  const { size, shape, color, x, y } = pose;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.strokeStyle = selected ? "#f8fafc" : "rgba(255,255,255,0.25)";
  ctx.lineWidth = selected ? 3 : 1.5;

  ctx.beginPath();
  switch (shape) {
    case "circle":
      ctx.arc(0, 0, size, 0, Math.PI * 2);
      break;
    case "square":
      ctx.rect(-size, -size, size * 2, size * 2);
      break;
    case "triangle":
      ctx.moveTo(0, -size);
      ctx.lineTo(size, size);
      ctx.lineTo(-size, size);
      ctx.closePath();
      break;
    case "diamond":
      ctx.moveTo(0, -size);
      ctx.lineTo(size, 0);
      ctx.lineTo(0, size);
      ctx.lineTo(-size, 0);
      ctx.closePath();
      break;
    case "hexagon": {
      for (let i = 0; i < 6; i += 1) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const px = Math.cos(a) * size;
        const py = Math.sin(a) * size;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
  }
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function TemporalChallenge({
  scene,
  poses,
  selectedObjectId,
  onSelect,
  interactive,
}: {
  scene: PublicScene;
  poses: ObjectPose[];
  selectedObjectId: string | null;
  onSelect: (objectId: string) => void;
  interactive: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const posesRef = useRef(poses);

  useEffect(() => {
    posesRef.current = poses;
  }, [poses]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    const loop = () => {
      ctx.clearRect(0, 0, scene.width, scene.height);
      ctx.fillStyle = "#0b1220";
      ctx.fillRect(0, 0, scene.width, scene.height);
      ctx.strokeStyle = "rgba(148,163,184,0.08)";
      ctx.lineWidth = 1;
      for (let x = 0; x < scene.width; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, scene.height);
        ctx.stroke();
      }
      for (let y = 0; y < scene.height; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(scene.width, y);
        ctx.stroke();
      }

      for (const pose of posesRef.current) {
        drawShape(ctx, pose, selectedObjectId === pose.id);
      }

      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [scene.height, scene.width, selectedObjectId]);

  const handlePointer = (clientX: number, clientY: number) => {
    if (!interactive) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = scene.width / rect.width;
    const scaleY = scene.height / rect.height;
    const point = {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };

    for (let i = posesRef.current.length - 1; i >= 0; i -= 1) {
      const pose = posesRef.current[i]!;
      const dx = point.x - pose.x;
      const dy = point.y - pose.y;
      if (dx * dx + dy * dy <= (pose.size + 4) * (pose.size + 4)) {
        onSelect(pose.id);
        return;
      }
    }
  };

  return (
    <div className="space-y-3">
      <canvas
        ref={canvasRef}
        width={scene.width}
        height={scene.height}
        className="w-full max-w-full cursor-crosshair rounded-md border border-slate-700/80 shadow-[0_0_0_1px_rgba(15,23,42,0.8)]"
        data-testid="temporal-canvas"
        onClick={(event) => handlePointer(event.clientX, event.clientY)}
        role="img"
        aria-label="Temporal object tracking challenge canvas"
      />
      <p className="text-xs text-slate-500">
        Poses are revealed progressively from the server during the active window.
        Watch the scene, then select the matching object.
      </p>
    </div>
  );
}
