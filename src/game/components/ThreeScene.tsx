import { Canvas, useFrame } from '@react-three/fiber'
import { Float, Sparkles } from '@react-three/drei'
import { useMemo, useRef } from 'react'
import type { Group, Mesh } from 'three'
import { useGameStore } from '../store/useGameStore'
import type { PageId } from '../types'

function Bookshelf({ position, color = '#3b2a1c', glow = false }: { position: [number, number, number]; color?: string; glow?: boolean }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.4, 2.2, 0.45]} />
        <meshStandardMaterial color={color} roughness={0.55} metalness={0.12} emissive={glow ? '#6b4dff' : '#000'} emissiveIntensity={glow ? 0.45 : 0} />
      </mesh>
      {[-0.7, -0.2, 0.3, 0.8].map((y, i) => (
        <mesh key={i} position={[0, y, 0.12]}>
          <boxGeometry args={[1.2, 0.08, 0.28]} />
          <meshStandardMaterial color="#5a3d28" />
        </mesh>
      ))}
      {Array.from({ length: 8 }).map((_, i) => (
        <mesh key={`b-${i}`} position={[-0.45 + (i % 4) * 0.3, -0.45 + Math.floor(i / 4) * 0.9, 0.18]} rotation={[0, 0, 0.02 * (i % 3)]}>
          <boxGeometry args={[0.18, 0.42, 0.12]} />
          <meshStandardMaterial color={['#6a4dff', '#2f6db5', '#c49a3c', '#7a3048'][i % 4]} metalness={0.2} roughness={0.4} />
        </mesh>
      ))}
    </group>
  )
}

function Desk({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[1.8, 0.1, 0.9]} />
        <meshStandardMaterial color="#4a3424" />
      </mesh>
      <mesh position={[-0.7, 0.2, -0.3]}>
        <boxGeometry args={[0.1, 0.4, 0.1]} />
        <meshStandardMaterial color="#3a281c" />
      </mesh>
      <mesh position={[0.7, 0.2, -0.3]}>
        <boxGeometry args={[0.1, 0.4, 0.1]} />
        <meshStandardMaterial color="#3a281c" />
      </mesh>
      <mesh position={[-0.7, 0.2, 0.3]}>
        <boxGeometry args={[0.1, 0.4, 0.1]} />
        <meshStandardMaterial color="#3a281c" />
      </mesh>
      <mesh position={[0.7, 0.2, 0.3]}>
        <boxGeometry args={[0.1, 0.4, 0.1]} />
        <meshStandardMaterial color="#3a281c" />
      </mesh>
      <pointLight position={[0, 0.9, 0]} intensity={1.2} distance={4} color="#ffd27a" />
    </group>
  )
}

function FloatingBook() {
  const ref = useRef<Mesh>(null)
  useFrame((state) => {
    if (!ref.current) return
    ref.current.rotation.y = state.clock.elapsedTime * 0.6
    ref.current.position.y = Math.sin(state.clock.elapsedTime) * 0.2
  })
  return (
    <mesh ref={ref} position={[0, 0.8, 0]} castShadow>
      <boxGeometry args={[0.9, 1.25, 0.16]} />
      <meshStandardMaterial color="#4b2f8f" metalness={0.35} roughness={0.25} emissive="#2a1658" emissiveIntensity={0.35} />
    </mesh>
  )
}

function QuestBoard() {
  return (
    <group position={[0, 0.6, -1]}>
      <mesh>
        <boxGeometry args={[3.2, 2.1, 0.12]} />
        <meshStandardMaterial color="#2a1d12" />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[-0.9 + i * 0.9, 0.2, 0.1]}>
          <planeGeometry args={[0.7, 1.1]} />
          <meshStandardMaterial color={['#f2c96b', '#8b6cff', '#4cc9f0'][i]} emissive={['#f2c96b', '#8b6cff', '#4cc9f0'][i]} emissiveIntensity={0.25} />
        </mesh>
      ))}
    </group>
  )
}

function HoloChart() {
  const ref = useRef<Group>(null)
  useFrame((s) => {
    if (ref.current) ref.current.rotation.y = s.clock.elapsedTime * 0.25
  })
  return (
    <group ref={ref}>
      {[0.6, 1.1, 0.8, 1.4, 1.0].map((h, i) => (
        <mesh key={i} position={[-1.2 + i * 0.6, h / 2, 0]}>
          <boxGeometry args={[0.28, h, 0.28]} />
          <meshStandardMaterial color="#4cc9f0" transparent opacity={0.55} emissive="#4cc9f0" emissiveIntensity={0.4} />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[1.8, 2.1, 48]} />
        <meshStandardMaterial color="#8b6cff" emissive="#8b6cff" emissiveIntensity={0.5} transparent opacity={0.6} />
      </mesh>
    </group>
  )
}

function SceneContent({ page }: { page: PageId }) {
  const selectedShelfId = useGameStore((s) => s.selectedShelfId)
  const shelves = useGameStore((s) => s.shelves)

  const cameraTarget = useMemo(() => {
    switch (page) {
      case 'lobby':
        return { pos: [0, 2.2, 7.2] as [number, number, number], look: [0, 1, 0] as [number, number, number] }
      case 'collection':
        return { pos: [0, 2.4, 6] as [number, number, number], look: [0, 1, 0] as [number, number, number] }
      case 'search':
        return { pos: [0, 1.8, 5.5] as [number, number, number], look: [0, 0.8, 0] as [number, number, number] }
      case 'detail':
        return { pos: [0, 1.4, 3.8] as [number, number, number], look: [0, 0.8, 0] as [number, number, number] }
      case 'shelving':
        return { pos: [0, 4.5, 7.5] as [number, number, number], look: [0, 0, 0] as [number, number, number] }
      case 'missions':
        return { pos: [0, 1.8, 5] as [number, number, number], look: [0, 0.8, -1] as [number, number, number] }
      case 'inventory':
        return { pos: [0, 2, 5.5] as [number, number, number], look: [0, 0.8, 0] as [number, number, number] }
      case 'stats':
        return { pos: [0, 2.2, 5.8] as [number, number, number], look: [0, 0.6, 0] as [number, number, number] }
      default:
        return { pos: [0, 2, 6] as [number, number, number], look: [0, 1, 0] as [number, number, number] }
    }
  }, [page])

  useFrame((state) => {
    state.camera.position.x += (cameraTarget.pos[0] - state.camera.position.x) * 0.05
    state.camera.position.y += (cameraTarget.pos[1] - state.camera.position.y) * 0.05
    state.camera.position.z += (cameraTarget.pos[2] - state.camera.position.z) * 0.05
    state.camera.lookAt(cameraTarget.look[0], cameraTarget.look[1], cameraTarget.look[2])
  })

  return (
    <>
      <color attach="background" args={['#070b18']} />
      <fog attach="fog" args={['#070b18', 8, 22]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 8, 3]} intensity={1.1} color="#d7e4ff" castShadow />
      <pointLight position={[-3, 3, 2]} intensity={1.4} color="#8b6cff" />
      <pointLight position={[3, 2.5, 1]} intensity={1.1} color="#f2c96b" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#12182b" />
      </mesh>

      {/* walls / hall vibe */}
      <mesh position={[0, 3, -6]}>
        <boxGeometry args={[18, 6, 0.4]} />
        <meshStandardMaterial color="#171f38" />
      </mesh>
      <mesh position={[-8, 3, 0]}>
        <boxGeometry args={[0.4, 6, 14]} />
        <meshStandardMaterial color="#141b31" />
      </mesh>
      <mesh position={[8, 3, 0]}>
        <boxGeometry args={[0.4, 6, 14]} />
        <meshStandardMaterial color="#141b31" />
      </mesh>

      {/* windows glow */}
      {[-3, 0, 3].map((x) => (
        <mesh key={x} position={[x, 3.2, -5.75]}>
          <planeGeometry args={[1.6, 2.2]} />
          <meshStandardMaterial color="#8fd7ff" emissive="#4cc9f0" emissiveIntensity={0.7} transparent opacity={0.55} />
        </mesh>
      ))}

      <Sparkles count={60} scale={[14, 6, 10]} size={2} speed={0.4} color="#c9b4ff" />

      {page === 'lobby' && (
        <>
          <Bookshelf position={[-4, 1.1, -2]} />
          <Bookshelf position={[-2.2, 1.1, -2.4]} />
          <Bookshelf position={[2.2, 1.1, -2.4]} />
          <Bookshelf position={[4, 1.1, -2]} />
          <Desk position={[0, 0, 0.5]} />
          <Float speed={1.4} rotationIntensity={0.2} floatIntensity={0.4}>
            <mesh position={[0, 0.02, 1.8]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[1.4, 48]} />
              <meshStandardMaterial color="#3b1f6d" emissive="#6a3dff" emissiveIntensity={0.25} />
            </mesh>
          </Float>
        </>
      )}

      {page === 'collection' && (
        <>
          {[-2.5, -0.8, 0.9, 2.6].map((x, i) => (
            <Float key={x} speed={1 + i * 0.1} floatIntensity={0.6}>
              <mesh position={[x, 1.2 + (i % 2) * 0.3, -0.5]} rotation={[0.2, 0.4 * i, 0.1]}>
                <boxGeometry args={[0.7, 1, 0.12]} />
                <meshStandardMaterial color={['#6a4dff', '#2f6db5', '#c49a3c', '#7a3048'][i]} metalness={0.3} />
              </mesh>
            </Float>
          ))}
          <Bookshelf position={[0, 1.1, -2.5]} />
        </>
      )}

      {page === 'search' && (
        <>
          <Desk position={[0, 0, 0]} />
          <mesh position={[0, 1.1, -0.1]}>
            <boxGeometry args={[1.1, 0.7, 0.08]} />
            <meshStandardMaterial color="#10182c" emissive="#4cc9f0" emissiveIntensity={0.25} />
          </mesh>
          <Bookshelf position={[-3.5, 1.1, -1.5]} />
          <Bookshelf position={[3.5, 1.1, -1.5]} />
        </>
      )}

      {page === 'detail' && (
        <>
          <FloatingBook />
          <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.9, 1.2, 48]} />
            <meshStandardMaterial color="#8b6cff" emissive="#8b6cff" emissiveIntensity={0.55} transparent opacity={0.7} />
          </mesh>
        </>
      )}

      {page === 'shelving' && (
        <>
          {shelves.map((shelf) => (
            <Bookshelf
              key={shelf.id}
              position={shelf.position}
              color={shelf.id === selectedShelfId ? '#3a2a58' : '#3b2a1c'}
              glow={shelf.id === selectedShelfId}
            />
          ))}
        </>
      )}

      {page === 'missions' && <QuestBoard />}

      {page === 'inventory' && (
        <>
          {[-1.8, -0.6, 0.6, 1.8].map((x, i) => (
            <Float key={x} speed={1.2 + i * 0.1}>
              <mesh position={[x, 1.1, 0]}>
                <boxGeometry args={[0.7, 0.7, 0.7]} />
                <meshStandardMaterial
                  color={['#4cc9f0', '#8b6cff', '#f2c96b', '#53e0a4'][i]}
                  metalness={0.4}
                  roughness={0.25}
                  emissive={['#4cc9f0', '#8b6cff', '#f2c96b', '#53e0a4'][i]}
                  emissiveIntensity={0.2}
                />
              </mesh>
            </Float>
          ))}
          <mesh position={[0, 0.4, 0]}>
            <boxGeometry args={[5.2, 0.15, 1.4]} />
            <meshStandardMaterial color="#2a2038" />
          </mesh>
        </>
      )}

      {page === 'stats' && <HoloChart />}
    </>
  )
}

export function ThreeScene() {
  const page = useGameStore((s) => s.page)
  const quality = useGameStore((s) => s.settings.quality)
  const dpr = quality === 'high' ? [1, 1.75] : quality === 'medium' ? [1, 1.25] : [1, 1]

  return (
    <div className="scene-layer" aria-hidden="true">
      <Canvas shadows dpr={dpr as [number, number]} camera={{ position: [0, 2.2, 7], fov: 45 }}>
        <SceneContent page={page} />
      </Canvas>
    </div>
  )
}
