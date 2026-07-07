import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore, type Stage } from '../store';
import { type FaceLetter } from '../lib/cube-engine';
import { SCENE } from '../lib/scene-config';

/**
 * Flies the camera on a cinematic tour whenever a CFOP stage is mastered:
 *   fly to the completed face → hold → survey all six faces (a helical 360°
 *   orbit that tilts up and down) → pause → return to the pre-flight rest view.
 *
 * State lives in refs and is driven from `useFrame`; nothing here re-renders.
 * The tour is gated on `store.isRotating` going false so it never starts while
 * the solving algorithm is still turning (OLL/PLL play a whole algorithm at
 * once), and on `cameraAnimationsEnabled` so the canvas settings toggle wins.
 *
 * All camera driving goes through the drei `<OrbitControls makeDefault>` (read
 * via `useThree`): we set `camera.position`/`controls.target` from a
 * THREE.Spherical each frame and call `controls.update()` so the controls stay
 * in sync and there's no jump when the user regains control.
 */

const CFG = SCENE.stageCamera;

type Phase = 'idle' | 'flyIn' | 'hold' | 'toSurvey' | 'survey' | 'surveyPause' | 'return' | 'faceView';

interface Pose {
  radius: number;
  phi: number;
  theta: number;
  target: THREE.Vector3;
}

// Minimal shape of the OrbitControls instance we drive.
interface ControlsLike {
  enabled: boolean;
  target: THREE.Vector3;
  update: () => void;
}

const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// Shortest signed distance between two azimuth angles, in (-π, π].
const shortestDelta = (from: number, to: number): number => {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

// The focus pose for a stage: frames the face that stage completes.
const focusPose = (stage: Stage): Pose => {
  const s = CFG[stage];
  const [tx, , tz] = CFG.target;
  return { radius: s.radius, phi: s.phi, theta: s.theta, target: new THREE.Vector3(tx, s.targetY, tz) };
};

const cubeCenter = (): THREE.Vector3 => new THREE.Vector3(CFG.target[0], CFG.target[1], CFG.target[2]);

// The pose that looks straight at a given face. Radius is kept from the current
// view so a face snap re-aims without zooming; for the top/bottom faces the
// azimuth is preserved too (a spin while looking down/up reads as noise).
const faceViewPose = (face: FaceLetter, current: Pose): Pose => {
  const p = SCENE.faceView.poses[face];
  const theta = face === 'U' || face === 'D' ? current.theta : p.theta;
  return { radius: current.radius, phi: p.phi, theta, target: cubeCenter() };
};

export function StageCameraDirector() {
  const controls = useThree((s) => s.controls) as unknown as ControlsLike | null;
  const camera = useThree((s) => s.camera);

  // Only masteredPulse needs a subscription (to latch the stage); everything
  // else is read fresh from the store inside useFrame to avoid re-render churn.
  const masteredPulse = useStore((s) => s.masteredPulse);
  // A view-key press (I/J/K/L/U/O) latches a face to snap to; it interrupts any
  // running mastery tour (latest input wins).
  const faceViewPulse = useStore((s) => s.faceViewPulse);

  const pendingStage = useRef<Stage | null>(null);
  const pendingFace = useRef<FaceLetter | null>(null);
  const faceFocus = useRef<Pose | null>(null);
  const phase = useRef<Phase>('idle');
  const phaseT = useRef(0); // seconds elapsed in the current phase

  const stageRef = useRef<Stage>('cross');
  const restPose = useRef<Pose | null>(null); // where to return to (captured at start)
  const focusRef = useRef<Pose | null>(null);
  const fromPose = useRef<Pose | null>(null); // start pose of the active lerp
  const surveyStart = useRef<Pose | null>(null);

  // Latch the stage that was just mastered; the tour starts once things settle.
  useEffect(() => {
    if (masteredPulse === 0) return;
    pendingStage.current = useStore.getState().masteredStage;
  }, [masteredPulse]);

  // Latch a requested face view; useFrame flies to it next frame.
  useEffect(() => {
    if (faceViewPulse === 0) return;
    pendingFace.current = useStore.getState().faceView;
  }, [faceViewPulse]);

  const readPose = (): Pose => {
    const offset = camera.position.clone().sub(controls!.target);
    const sph = new THREE.Spherical().setFromVector3(offset);
    return { radius: sph.radius, phi: sph.phi, theta: sph.theta, target: controls!.target.clone() };
  };

  const applyPose = (radius: number, phi: number, theta: number, target: THREE.Vector3) => {
    const offset = new THREE.Vector3().setFromSpherical(new THREE.Spherical(radius, phi, theta));
    camera.position.copy(target).add(offset);
    controls!.target.copy(target);
    controls!.update();
  };

  const lerpPose = (a: Pose, b: Pose, e: number) => {
    applyPose(
      THREE.MathUtils.lerp(a.radius, b.radius, e),
      THREE.MathUtils.lerp(a.phi, b.phi, e),
      a.theta + shortestDelta(a.theta, b.theta) * e,
      a.target.clone().lerp(b.target, e)
    );
  };

  useFrame((_, delta) => {
    if (!controls) return;
    const { isRotating, cameraAnimationsEnabled: enabled } = useStore.getState();
    const sv = CFG.survey;

    // A face-view key press interrupts any phase and flies straight to the face.
    // It's a manual request, so it ignores `cameraAnimationsEnabled` (that only
    // gates the automatic mastery tour).
    if (pendingFace.current) {
      const face = pendingFace.current;
      pendingFace.current = null;
      pendingStage.current = null; // cancel any queued mastery tour
      fromPose.current = readPose();
      faceFocus.current = faceViewPose(face, fromPose.current);
      controls.enabled = false;
      phase.current = 'faceView';
      phaseT.current = 0;
    }

    if (phase.current === 'idle') {
      const st = pendingStage.current;
      if (!st) return;
      if (!enabled) {
        pendingStage.current = null; // tour disabled — drop it
        return;
      }
      if (isRotating) return; // wait for the algorithm to finish turning
      restPose.current = readPose();
      focusRef.current = focusPose(st);
      fromPose.current = restPose.current;
      stageRef.current = st;
      controls.enabled = false;
      phase.current = 'flyIn';
      phaseT.current = 0;
      return;
    }

    // If the user turns the tour off mid-flight, glide back to rest gracefully.
    // A face-view snap is a manual move (not the tour), so it's exempt.
    if (!enabled && phase.current !== 'return' && phase.current !== 'faceView') {
      fromPose.current = readPose();
      phase.current = 'return';
      phaseT.current = 0;
    }

    phaseT.current += delta;

    switch (phase.current) {
      case 'flyIn': {
        const e = easeInOutCubic(Math.min(phaseT.current / CFG.flyDuration, 1));
        lerpPose(fromPose.current!, focusRef.current!, e);
        if (phaseT.current >= CFG.flyDuration) {
          phase.current = 'hold';
          phaseT.current = 0;
        }
        break;
      }
      case 'hold': {
        if (phaseT.current >= CFG.holdDuration) {
          surveyStart.current = {
            radius: sv.radius,
            phi: sv.polarMid,
            theta: focusRef.current!.theta,
            target: cubeCenter(),
          };
          fromPose.current = focusRef.current;
          phase.current = 'toSurvey';
          phaseT.current = 0;
        }
        break;
      }
      case 'toSurvey': {
        const e = easeInOutCubic(Math.min(phaseT.current / sv.toSurveyDuration, 1));
        lerpPose(fromPose.current!, surveyStart.current!, e);
        if (phaseT.current >= sv.toSurveyDuration) {
          phase.current = 'survey';
          phaseT.current = 0;
        }
        break;
      }
      case 'survey': {
        const e = easeInOutCubic(Math.min(phaseT.current / sv.duration, 1));
        const sweep = 2 * Math.PI * sv.turns * e;
        applyPose(
          sv.radius,
          sv.polarMid + sv.polarAmp * Math.sin(sweep),
          surveyStart.current!.theta + sweep,
          cubeCenter()
        );
        if (phaseT.current >= sv.duration) {
          // End pose of the helix (one full turn → same azimuth, mid polar).
          fromPose.current = {
            radius: sv.radius,
            phi: sv.polarMid,
            theta: surveyStart.current!.theta + 2 * Math.PI * sv.turns,
            target: cubeCenter(),
          };
          phase.current = 'surveyPause';
          phaseT.current = 0;
        }
        break;
      }
      case 'surveyPause': {
        if (phaseT.current >= sv.pauseDuration) {
          phase.current = 'return';
          phaseT.current = 0;
        }
        break;
      }
      case 'return': {
        const e = easeInOutCubic(Math.min(phaseT.current / CFG.returnDuration, 1));
        lerpPose(fromPose.current!, restPose.current!, e);
        if (phaseT.current >= CFG.returnDuration) {
          controls.enabled = true;
          pendingStage.current = null;
          phase.current = 'idle';
          phaseT.current = 0;
        }
        break;
      }
      case 'faceView': {
        const e = easeInOutCubic(Math.min(phaseT.current / SCENE.faceView.flyDuration, 1));
        lerpPose(fromPose.current!, faceFocus.current!, e);
        if (phaseT.current >= SCENE.faceView.flyDuration) {
          controls.enabled = true; // hand control back so the user can orbit from here
          phase.current = 'idle';
          phaseT.current = 0;
        }
        break;
      }
    }
  });

  return null;
}
