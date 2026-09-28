import { useCallback, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { Plane, Raycaster, Vector2, Vector3, type Ray } from 'three';

/** Pixels a pointer must travel before a press becomes a drag (below it, it's a tap). */
const DRAG_THRESHOLD_PX = 6;

export interface DragHandlers {
  /** Called once when movement passes the threshold. */
  onStart: () => void;
  /** Called with the world-space pointer ray on every move after start. */
  onMove: (ray: Ray) => void;
  /** Called on release/cancel. `moved` is false for a plain tap. */
  onEnd: (moved: boolean) => void;
}

interface OrbitLike {
  enabled: boolean;
}

const isOrbitLike = (value: unknown): value is OrbitLike =>
  typeof value === 'object' && value !== null && 'enabled' in value;

/**
 * Window-level pointer tracking for dragging things inside the r3f canvas.
 * Works the same for mouse and touch, pauses the orbit camera for the gesture,
 * and aborts if a second finger lands (so pinch-zoom keeps working).
 */
export const useCanvasDrag = () => {
  const { camera, gl, controls } = useThree();
  const raycaster = useRef(new Raycaster());
  const ndc = useRef(new Vector2());

  const rayAt = useCallback(
    (clientX: number, clientY: number): Ray => {
      const rect = gl.domElement.getBoundingClientRect();
      ndc.current.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.current.setFromCamera(ndc.current, camera);
      return raycaster.current.ray;
    },
    [camera, gl],
  );

  const begin = useCallback(
    (start: { pointerId: number; clientX: number; clientY: number }, handlers: DragHandlers) => {
      const orbit = isOrbitLike(controls) ? controls : null;
      if (orbit) orbit.enabled = false;
      let started = false;

      const finish = (): void => {
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
        window.removeEventListener('pointercancel', handleUp);
        window.removeEventListener('pointerdown', handleOtherDown);
        if (orbit) orbit.enabled = true;
        handlers.onEnd(started);
      };

      function handleMove(event: PointerEvent): void {
        if (event.pointerId !== start.pointerId) return;
        if (!started) {
          const dist = Math.hypot(event.clientX - start.clientX, event.clientY - start.clientY);
          if (dist < DRAG_THRESHOLD_PX) return;
          started = true;
          handlers.onStart();
        }
        handlers.onMove(rayAt(event.clientX, event.clientY));
      }

      function handleUp(event: PointerEvent): void {
        if (event.pointerId === start.pointerId) finish();
      }

      function handleOtherDown(event: PointerEvent): void {
        if (event.pointerId !== start.pointerId) finish();
      }

      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
      window.addEventListener('pointercancel', handleUp);
      window.addEventListener('pointerdown', handleOtherDown);
    },
    [controls, rayAt],
  );

  return { begin, rayAt, camera };
};

/** Intersect a ray with a plane; null when parallel. */
export const intersect = (ray: Ray, plane: Plane): Vector3 | null =>
  ray.intersectPlane(plane, new Vector3());
