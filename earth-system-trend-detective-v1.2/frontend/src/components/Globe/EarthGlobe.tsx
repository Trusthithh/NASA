import React, { Component, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";

const RADIUS = 2.5;
const DEG = Math.PI / 180;

// The bundled texture loads instantly; higher-resolution textures are tried afterwards
// and swapped in if one of them loads. VITE_GLOBE_TEXTURE_URL is tried first.
const LOCAL_TEXTURE = `${import.meta.env.BASE_URL}textures/earth.jpg`;
const HD_TEXTURES = [
  import.meta.env.VITE_GLOBE_TEXTURE_URL ?? "",
  "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r169/examples/textures/planets/earth_atmos_2048.jpg",
  "https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg",
].filter((url) => url.length > 0);

export interface GlobePoint {
  lat: number;
  lon: number;
}

interface EarthGlobeProps {
  selected?: GlobePoint | null;
  secondary?: GlobePoint | null; // optional second marker (blue), e.g. "Place B"
  secondaryColor?: string;
  onPick?: (lat: number, lon: number) => void;
  heightClass?: string;
  distance?: number;
}

// Matches three.js SphereGeometry + an equirectangular texture (lon 0 on the +x axis).
export function latLonToVector(lat: number, lon: number, radius: number): THREE.Vector3 {
  const la = lat * DEG;
  const lo = lon * DEG;
  return new THREE.Vector3(
    radius * Math.cos(la) * Math.cos(lo),
    radius * Math.sin(la),
    -radius * Math.cos(la) * Math.sin(lo)
  );
}

export function vectorToLatLon(v: THREE.Vector3): GlobePoint {
  const r = v.length();
  return { lat: Math.asin(v.y / r) / DEG, lon: Math.atan2(-v.z, v.x) / DEG };
}

function loadTexture(url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(
      url,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 8;
        resolve(texture);
      },
      undefined,
      () => reject(new Error(`Texture failed: ${url}`))
    );
  });
}

function useEarthTexture(): THREE.Texture | null {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    let cancelled = false;
    let current: THREE.Texture | null = null;

    const apply = (next: THREE.Texture) => {
      if (cancelled) {
        next.dispose();
        return;
      }
      const previous = current;
      current = next;
      setTexture(next);
      previous?.dispose();
    };

    (async () => {
      try {
        apply(await loadTexture(LOCAL_TEXTURE));
      } catch {
        /* fall through to the remote textures */
      }
      for (const url of HD_TEXTURES) {
        if (cancelled) return;
        try {
          apply(await loadTexture(url));
          return;
        } catch {
          /* try the next candidate */
        }
      }
    })();

    return () => {
      cancelled = true;
      current?.dispose();
    };
  }, []);

  return texture;
}

function buildGraticule(radius: number, step = 30, segments = 72): THREE.BufferGeometry {
  const pts: number[] = [];
  const push = (a: THREE.Vector3, b: THREE.Vector3) => pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
  for (let lon = -180; lon < 180; lon += step) {
    for (let i = 0; i < segments; i++) {
      const lat1 = -90 + (180 * i) / segments;
      const lat2 = -90 + (180 * (i + 1)) / segments;
      push(latLonToVector(lat1, lon, radius), latLonToVector(lat2, lon, radius));
    }
  }
  for (let lat = -60; lat <= 60; lat += step) {
    for (let i = 0; i < segments; i++) {
      const lon1 = -180 + (360 * i) / segments;
      const lon2 = -180 + (360 * (i + 1)) / segments;
      push(latLonToVector(lat, lon1, radius), latLonToVector(lat, lon2, radius));
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  return geometry;
}

class GlobeBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

const GlobeUnavailable: React.FC<{ heightClass: string }> = ({ heightClass }) => (
  <div
    className={`${heightClass} flex w-full items-center justify-center rounded-3xl border border-slate-800 bg-slate-900/60 p-8 text-center text-sm text-slate-300`}
  >
    The 3D globe is unavailable on this device. Use the search box or enter coordinates instead.
  </div>
);

// Smoothly turns the camera to face the selected location.
const CameraRig: React.FC<{ target: GlobePoint | null }> = ({ target }) => {
  const camera = useThree((state) => state.camera);
  const goal = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    goal.current = target ? latLonToVector(target.lat, target.lon, 1).normalize() : null;
  }, [target?.lat, target?.lon]);

  useFrame((_, delta) => {
    if (!goal.current) return;
    const distance = camera.position.length();
    const direction = camera.position.clone().normalize();
    if (direction.angleTo(goal.current) < 0.01) {
      goal.current = null;
      return;
    }
    direction.lerp(goal.current, Math.min(1, delta * 3)).normalize();
    camera.position.copy(direction.multiplyScalar(distance));
    camera.lookAt(0, 0, 0);
  });

  return null;
};

const Marker: React.FC<{ point: GlobePoint; color?: string }> = ({ point, color = "#fbbf24" }) => {
  const ring = useRef<THREE.Mesh>(null);
  const { position, quaternion } = useMemo(() => {
    const normal = latLonToVector(point.lat, point.lon, 1).normalize();
    return {
      position: normal.clone().multiplyScalar(RADIUS * 1.006),
      quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal),
    };
  }, [point.lat, point.lon]);

  useFrame(({ clock }) => {
    if (!ring.current) return;
    const phase = (clock.elapsedTime * 0.9) % 1;
    const scale = 1 + phase * 1.6;
    ring.current.scale.set(scale, scale, 1);
    (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - phase);
  });

  return (
    <group position={position} quaternion={quaternion}>
      <mesh>
        <sphereGeometry args={[0.045, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh ref={ring}>
        <ringGeometry args={[0.07, 0.085, 48]} />
        <meshBasicMaterial color={color} transparent side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
};

interface GlobeMeshProps {
  selected: GlobePoint | null;
  secondary: GlobePoint | null;
  secondaryColor: string;
  onPick?: (lat: number, lon: number) => void;
  onHover: (point: GlobePoint | null) => void;
}

const GlobeMesh: React.FC<GlobeMeshProps> = ({ selected, secondary, secondaryColor, onPick, onHover }) => {
  const texture = useEarthTexture();
  const graticule = useMemo(() => buildGraticule(RADIUS * 1.002), []);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (!onPick || e.delta > 4) return; // ignore drags
    e.stopPropagation();
    const p = vectorToLatLon(e.point);
    onPick(Number(p.lat.toFixed(2)), Number(p.lon.toFixed(2)));
  };

  return (
    <group>
      <mesh
        onClick={handleClick}
        onPointerMove={(e) => onHover(vectorToLatLon(e.point))}
        onPointerOut={() => onHover(null)}
      >
        <sphereGeometry args={[RADIUS, 96, 96]} />
        <meshStandardMaterial
          key={texture ? "textured" : "plain"}
          map={texture ?? undefined}
          color={texture ? "#ffffff" : "#1d4f91"}
          roughness={0.85}
          metalness={0.05}
        />
      </mesh>
      <lineSegments geometry={graticule}>
        <lineBasicMaterial color="#7dd3fc" transparent opacity={0.1} />
      </lineSegments>
      <mesh>
        <sphereGeometry args={[RADIUS * 1.045, 64, 64]} />
        <meshBasicMaterial
          color="#5ab0ff"
          transparent
          opacity={0.16}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {selected && <Marker point={selected} />}
      {secondary && <Marker point={secondary} color={secondaryColor} />}
    </group>
  );
};

export const EarthGlobe: React.FC<EarthGlobeProps> = ({
  selected = null,
  secondary = null,
  secondaryColor = "#38bdf8",
  onPick,
  heightClass = "h-[500px] lg:h-[600px]",
  distance = 7.5,
}) => {
  const hoverRef = useRef<HTMLSpanElement>(null);

  const handleHover = useCallback((p: GlobePoint | null) => {
    if (hoverRef.current) {
      hoverRef.current.textContent = p ? `${p.lat.toFixed(1)}°, ${p.lon.toFixed(1)}°` : "";
    }
  }, []);

  return (
    <div className={`relative w-full ${heightClass} ${onPick ? "cursor-crosshair" : "cursor-grab"}`}>
      <GlobeBoundary fallback={<GlobeUnavailable heightClass={heightClass} />}>
        <Canvas
          camera={{ position: [0, 0, distance], fov: 45 }}
          fallback={<GlobeUnavailable heightClass={heightClass} />}
        >
          <ambientLight intensity={1.15} />
          <directionalLight position={[5, 3, 5]} intensity={2.2} />
          <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade />
          <GlobeMesh
            selected={selected}
            secondary={secondary}
            secondaryColor={secondaryColor}
            onPick={onPick}
            onHover={handleHover}
          />
          <CameraRig target={selected} />
          <OrbitControls
            enableZoom
            enablePan={false}
            minDistance={4.2}
            maxDistance={14}
            autoRotate={!selected}
            autoRotateSpeed={0.5}
          />
        </Canvas>
      </GlobeBoundary>
      <div className="pointer-events-none absolute bottom-3 left-4 font-mono text-xs text-cyan-300">
        <span ref={hoverRef} />
      </div>
      {onPick && (
        <div className="pointer-events-none absolute bottom-3 right-4 hidden rounded-full border border-cyan-500/30 bg-slate-900/70 px-3 py-1 font-mono text-xs text-cyan-300 backdrop-blur-sm sm:block">
          Drag to rotate - Scroll to zoom - Click to select
        </div>
      )}
    </div>
  );
};
