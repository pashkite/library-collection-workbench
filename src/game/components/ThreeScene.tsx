import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, Environment, Float, Sparkles, useGLTF } from '@react-three/drei'
import { Suspense, useMemo, useRef, type ComponentProps, type ReactNode } from 'react'
import type { Group } from 'three'
import * as THREE from 'three'
import { useGameStore } from '../store/useGameStore'
import type { PageId } from '../types'

const BASE = import.meta.env.BASE_URL

function modelUrl(name: string) {
  return `${BASE}models/${name}`
}

function ScaledModel({
  url,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  glow = false,
}: {
  url: string
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number | [number, number, number]
  glow?: boolean
}) {
  const { scene } = useGLTF(url)
  const cloned = useMemo(() => {
    const root = scene.clone(true)
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (mesh.isMesh) {
        mesh.castShadow = true
        mesh.receiveShadow = true
        if (glow && mesh.material && 'emissive' in mesh.material) {
          const mat = (mesh.material as THREE.MeshStandardMaterial).clone()
          mat.emissive = new THREE.Color('#7c5cff')
          mat.emissiveIntensity = 0.35
          mesh.material = mat
        }
      }
    })
    return root
  }, [scene, glow])

  return <primitive object={cloned} position={position} rotation={rotation} scale={scale} />
}

function FallbackShelf({
  position,
  glow = false,
}: {
  position: [number, number, number]
  glow?: boolean
}) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.5, 2.4, 0.5]} />
        <meshStandardMaterial
          color={glow ? '#3a2a68' : '#4a3426'}
          roughness={0.55}
          metalness={0.08}
          emissive={glow ? '#6b4dff' : '#000'}
          emissiveIntensity={glow ? 0.4 : 0}
        />
      </mesh>
    </group>
  )
}

function SafeModel(props: ComponentProps<typeof ScaledModel> & { fallback?: ReactNode }) {
  return (
    <Suspense fallback={props.fallback ?? null}>
      <ScaledModel {...props} />
    </Suspense>
  )
}

function SceneContent({ page }: { page: PageId }) {
  const selectedShelfId = useGameStore((s) => s.selectedShelfId)
  const shelves = useGameStore((s) => s.shelves)
  const group = useRef<Group>(null)

  const cameraTarget = useMemo(() => {
    switch (page) {
      case 'lobby':
        return { pos: [2.4, 2.4, 6.8] as [number, number, number], look: [0, 1.1, 0] as [number, number, number] }
      case 'collection':
        return { pos: [0, 2.2, 6.2] as [number, number, number], look: [0, 1.1, 0] as [number, number, number] }
      case 'search':
        return { pos: [0.8, 1.9, 5.4] as [number, number, number], look: [0, 0.9, 0] as [number, number, number] }
      case 'detail':
        return { pos: [0, 1.5, 3.6] as [number, number, number], look: [0, 0.9, 0] as [number, number, number] }
      case 'shelving':
        return { pos: [0, 5.2, 8.2] as [number, number, number], look: [0, 0.4, 0] as [number, number, number] }
      case 'missions':
        return { pos: [0, 2.0, 5.6] as [number, number, number], look: [0, 1.0, -0.5] as [number, number, number] }
      case 'inventory':
        return { pos: [0, 2.1, 5.8] as [number, number, number], look: [0, 0.9, 0] as [number, number, number] }
      case 'stats':
        return { pos: [0, 2.4, 6.0] as [number, number, number], look: [0, 0.8, 0] as [number, number, number] }
      default:
        return { pos: [0, 2.2, 6.5] as [number, number, number], look: [0, 1, 0] as [number, number, number] }
    }
  }, [page])

  useFrame((state) => {
    state.camera.position.x += (cameraTarget.pos[0] - state.camera.position.x) * 0.045
    state.camera.position.y += (cameraTarget.pos[1] - state.camera.position.y) * 0.045
    state.camera.position.z += (cameraTarget.pos[2] - state.camera.position.z) * 0.045
    state.camera.lookAt(cameraTarget.look[0], cameraTarget.look[1], cameraTarget.look[2])
    if (group.current && page === 'lobby') {
      group.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.12) * 0.04
    }
  })

  return (
    <>
      <color attach="background" args={['#0a1020']} />
      <fog attach="fog" args={['#0a1020', 10, 28]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[5, 9, 4]} intensity={1.35} color="#fff4df" castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[-4, 3.2, 2]} intensity={1.5} color="#9b7cff" distance={14} />
      <pointLight position={[3.5, 2.4, 1.5]} intensity={1.2} color="#ffd27a" distance={12} />
      <hemisphereLight args={['#b7c8ff', '#1a1428', 0.45]} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial color="#121a2e" roughness={0.9} />
      </mesh>

      {/* hall walls */}
      <mesh position={[0, 3.2, -7.2]}>
        <boxGeometry args={[20, 7, 0.4]} />
        <meshStandardMaterial color="#18233d" />
      </mesh>
      <mesh position={[-9, 3.2, 0]}>
        <boxGeometry args={[0.4, 7, 16]} />
        <meshStandardMaterial color="#151d34" />
      </mesh>
      <mesh position={[9, 3.2, 0]}>
        <boxGeometry args={[0.4, 7, 16]} />
        <meshStandardMaterial color="#151d34" />
      </mesh>

      {/* window glow */}
      {[-3.4, 0, 3.4].map((x) => (
        <mesh key={x} position={[x, 3.3, -6.95]}>
          <planeGeometry args={[2.1, 2.8]} />
          <meshStandardMaterial color="#9fd7ff" emissive="#4cc9f0" emissiveIntensity={0.85} transparent opacity={0.55} />
        </mesh>
      ))}

      <Sparkles count={70} scale={[16, 7, 12]} size={2.2} speed={0.35} color="#d7c6ff" opacity={0.55} />
      <ContactShadows position={[0, 0.01, 0]} opacity={0.45} scale={18} blur={2.4} far={8} />

      <group ref={group}>
        {(page === 'lobby' || page === 'collection' || page === 'search') && (
          <>
            <SafeModel
              url={modelUrl('bookshelf.glb')}
              position={[-3.8, 0, -2.2]}
              scale={1.15}
              rotation={[0, 0.2, 0]}
              fallback={<FallbackShelf position={[-3.8, 1.1, -2.2]} />}
            />
            <SafeModel
              url={modelUrl('bookcase.glb')}
              position={[-1.8, 0, -2.6]}
              scale={1.4}
              rotation={[0, 0.05, 0]}
              fallback={<FallbackShelf position={[-1.8, 1.1, -2.6]} />}
            />
            <SafeModel
              url={modelUrl('bookshelf.glb')}
              position={[2.0, 0, -2.5]}
              scale={1.15}
              rotation={[0, -0.15, 0]}
              fallback={<FallbackShelf position={[2.0, 1.1, -2.5]} />}
            />
            <SafeModel
              url={modelUrl('small-bookshelf.glb')}
              position={[4.0, 0, -2.0]}
              scale={1.6}
              rotation={[0, -0.3, 0]}
              fallback={<FallbackShelf position={[4.0, 1.1, -2.0]} />}
            />
          </>
        )}

        {page === 'lobby' && (
          <>
            <SafeModel url={modelUrl('table.glb')} position={[0.1, 0, 0.8]} scale={1.8} />
            <SafeModel url={modelUrl('chair.glb')} position={[0.9, 0, 1.5]} scale={1.5} rotation={[0, -0.6, 0]} />
            <SafeModel url={modelUrl('lamp.glb')} position={[-1.4, 0, 1.1]} scale={1.3} />
            <SafeModel url={modelUrl('rug.glb')} position={[0.1, 0.01, 1.8]} scale={2.4} />
            <SafeModel url={modelUrl('book-stack.glb')} position={[-0.35, 0.72, 0.75]} scale={1.1} />
            <SafeModel url={modelUrl('open-book.glb')} position={[0.45, 0.72, 0.9]} scale={1.3} rotation={[0, 0.4, 0]} />
            <Float speed={1.2} floatIntensity={0.35}>
              <mesh position={[0.1, 0.04, 2.1]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[1.35, 1.55, 64]} />
                <meshStandardMaterial color="#8b6cff" emissive="#8b6cff" emissiveIntensity={0.55} transparent opacity={0.55} />
              </mesh>
            </Float>
          </>
        )}

        {page === 'collection' && (
          <>
            {[-2.4, -0.8, 0.8, 2.4].map((x, i) => (
              <Float key={x} speed={1 + i * 0.08} floatIntensity={0.5}>
                <SafeModel
                  url={modelUrl(i % 2 === 0 ? 'open-book.glb' : 'book-stack.glb')}
                  position={[x, 1.3 + (i % 2) * 0.15, -0.2]}
                  scale={i % 2 === 0 ? 1.5 : 1.2}
                  rotation={[0.1, 0.3 * i, 0.05]}
                />
              </Float>
            ))}
          </>
        )}

        {page === 'search' && (
          <>
            <SafeModel url={modelUrl('table.glb')} position={[0, 0, 0.2]} scale={1.7} />
            <SafeModel url={modelUrl('open-book.glb')} position={[0.2, 0.72, 0.25]} scale={1.4} />
            <SafeModel url={modelUrl('lamp.glb')} position={[-1.2, 0, 0.4]} scale={1.2} />
            <mesh position={[0, 1.15, -0.35]}>
              <boxGeometry args={[1.2, 0.75, 0.08]} />
              <meshStandardMaterial color="#10182c" emissive="#4cc9f0" emissiveIntensity={0.35} metalness={0.4} roughness={0.25} />
            </mesh>
          </>
        )}

        {page === 'detail' && (
          <>
            <Float speed={1.4} rotationIntensity={0.35} floatIntensity={0.45}>
              <SafeModel url={modelUrl('open-book.glb')} position={[0, 1.0, 0]} scale={2.2} />
            </Float>
            <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[1.0, 1.35, 64]} />
              <meshStandardMaterial color="#8b6cff" emissive="#8b6cff" emissiveIntensity={0.7} transparent opacity={0.7} />
            </mesh>
          </>
        )}

        {page === 'shelving' && (
          <>
            {shelves.map((shelf, i) => (
              <SafeModel
                key={shelf.id}
                url={modelUrl(i % 2 === 0 ? 'bookshelf.glb' : 'bookcase.glb')}
                position={shelf.position}
                scale={i % 2 === 0 ? 1.05 : 1.25}
                glow={shelf.id === selectedShelfId}
                fallback={<FallbackShelf position={shelf.position} glow={shelf.id === selectedShelfId} />}
              />
            ))}
          </>
        )}

        {page === 'missions' && (
          <>
            <SafeModel url={modelUrl('table.glb')} position={[0, 0, -0.4]} scale={1.6} />
            <SafeModel url={modelUrl('book-stack.glb')} position={[-0.6, 0.72, -0.3]} scale={1.3} />
            <SafeModel url={modelUrl('open-book.glb')} position={[0.5, 0.72, -0.2]} scale={1.4} />
            <mesh position={[0, 1.5, -1.4]}>
              <boxGeometry args={[3.4, 2.0, 0.12]} />
              <meshStandardMaterial color="#2b2118" roughness={0.7} />
            </mesh>
            {[0, 1, 2].map((i) => (
              <mesh key={i} position={[-1.0 + i * 1.0, 1.55, -1.3]}>
                <planeGeometry args={[0.75, 1.15]} />
                <meshStandardMaterial
                  color={['#f2c96b', '#8b6cff', '#4cc9f0'][i]}
                  emissive={['#f2c96b', '#8b6cff', '#4cc9f0'][i]}
                  emissiveIntensity={0.28}
                />
              </mesh>
            ))}
          </>
        )}

        {page === 'inventory' && (
          <>
            <SafeModel url={modelUrl('table.glb')} position={[0, 0, 0.3]} scale={2.1} />
            {[-1.6, -0.55, 0.55, 1.6].map((x, i) => (
              <Float key={x} speed={1.1 + i * 0.1} floatIntensity={0.35}>
                <SafeModel
                  url={modelUrl(i % 2 === 0 ? 'book-stack.glb' : 'open-book.glb')}
                  position={[x, 0.85, 0.3]}
                  scale={1.15}
                />
              </Float>
            ))}
          </>
        )}

        {page === 'stats' && (
          <>
            <SafeModel url={modelUrl('small-bookshelf.glb')} position={[-2.8, 0, -1.2]} scale={1.4} />
            <group>
              {[0.7, 1.25, 0.95, 1.55, 1.1].map((h, i) => (
                <mesh key={i} position={[-1.1 + i * 0.55, h / 2 + 0.2, 0]}>
                  <boxGeometry args={[0.32, h, 0.32]} />
                  <meshStandardMaterial color="#4cc9f0" transparent opacity={0.65} emissive="#4cc9f0" emissiveIntensity={0.45} />
                </mesh>
              ))}
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
                <ringGeometry args={[1.9, 2.2, 64]} />
                <meshStandardMaterial color="#8b6cff" emissive="#8b6cff" emissiveIntensity={0.55} transparent opacity={0.65} />
              </mesh>
            </group>
          </>
        )}
      </group>

      <Suspense fallback={null}>
        <Environment preset="night" />
      </Suspense>
    </>
  )
}

// preload free assets
;[
  'bookshelf.glb',
  'bookcase.glb',
  'small-bookshelf.glb',
  'open-book.glb',
  'book-stack.glb',
  'table.glb',
  'lamp.glb',
  'chair.glb',
  'rug.glb',
].forEach((f) => useGLTF.preload(modelUrl(f)))

export function ThreeScene() {
  const page = useGameStore((s) => s.page)
  const quality = useGameStore((s) => s.settings.quality)
  const dpr = quality === 'high' ? ([1, 1.6] as [number, number]) : quality === 'medium' ? ([1, 1.25] as [number, number]) : ([1, 1] as [number, number])

  return (
    <div className="scene-layer" aria-hidden="true">
      <Canvas shadows dpr={dpr} camera={{ position: [2.4, 2.4, 6.8], fov: 42 }} gl={{ antialias: true, alpha: false }}>
        <SceneContent page={page} />
      </Canvas>
    </div>
  )
}
