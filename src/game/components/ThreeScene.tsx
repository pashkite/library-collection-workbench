import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, Float, Html, Sparkles, useGLTF } from '@react-three/drei'
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { Group } from 'three'
import * as THREE from 'three'
import { useGameStore } from '../store/useGameStore'
import type { PageId } from '../types'

const BASE = import.meta.env.BASE_URL

function modelUrl(name: string) {
  return `${BASE}models/${name}`
}

type Station = {
  id: PageId
  path: string
  index: string
  title: string
  subtitle: string
  position: [number, number, number]
  color: string
}

const stations: Station[] = [
  {
    id: 'collection',
    path: '/game/collection',
    index: '01',
    title: '장서 수집실',
    subtitle: '수집률 · 분야 현황',
    position: [-3.35, 0, -1.65],
    color: '#e7b85c',
  },
  {
    id: 'search',
    path: '/game/search',
    index: '02',
    title: '검색 기록실',
    subtitle: '서명 · 저자 · ISBN',
    position: [0, 0, 0.65],
    color: '#5ed4ff',
  },
  {
    id: 'missions',
    path: '/game/missions',
    index: '03',
    title: '오늘의 업무',
    subtitle: '미션 · 진행 보상',
    position: [3.35, 0, -1.65],
    color: '#9f83ff',
  },
  {
    id: 'shelving',
    path: '/game/shelving',
    index: '04',
    title: '서가 배치실',
    subtitle: '위치 · 수용량',
    position: [-3.05, 0, 2.15],
    color: '#72e3b7',
  },
  {
    id: 'inventory',
    path: '/game/inventory',
    index: '05',
    title: '업무 도구함',
    subtitle: '아이템 · 장비',
    position: [3.05, 0, 2.15],
    color: '#ff9f7c',
  },
  {
    id: 'stats',
    path: '/game/stats',
    index: '06',
    title: '통계 관측실',
    subtitle: '성과 · 환경 설정',
    position: [0, 0, -3.65],
    color: '#6ee7ff',
  },
]

function ScaledModel({
  url,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  glow,
}: {
  url: string
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number | [number, number, number]
  glow?: string
}) {
  const { scene } = useGLTF(url)
  const cloned = useMemo(() => {
    const root = scene.clone(true)
    root.traverse((object) => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
      if (mesh.material && 'roughness' in mesh.material) {
        const material = (mesh.material as THREE.MeshStandardMaterial).clone()
        material.roughness = Math.max(material.roughness ?? 0.5, 0.42)
        if (glow) {
          material.emissive = new THREE.Color(glow)
          material.emissiveIntensity = 0.18
        }
        mesh.material = material
      }
    })
    return root
  }, [glow, scene])

  return <primitive object={cloned} position={position} rotation={rotation} scale={scale} />
}

function SafeModel(props: ComponentProps<typeof ScaledModel> & { fallback?: ReactNode }) {
  const { fallback, ...modelProps } = props
  return (
    <Suspense fallback={fallback ?? null}>
      <ScaledModel {...modelProps} />
    </Suspense>
  )
}

function FallbackShelf({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, 1.05, 0]}>
        <boxGeometry args={[1.45, 2.1, 0.42]} />
        <meshStandardMaterial color="#4c3524" roughness={0.72} />
      </mesh>
      {[-0.7, -0.2, 0.3, 0.8].map((y) => (
        <mesh key={y} position={[0, y + 1.05, 0.24]}>
          <boxGeometry args={[1.24, 0.07, 0.34]} />
          <meshStandardMaterial color="#25190f" roughness={0.8} />
        </mesh>
      ))}
    </group>
  )
}

function StoneArch({ x, rotationY = 0 }: { x: number; rotationY?: number }) {
  return (
    <group position={[x, 0, -5.65]} rotation={[0, rotationY, 0]}>
      <mesh position={[-0.82, 1.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.42, 3.1, 0.55]} />
        <meshStandardMaterial color="#253044" roughness={0.9} />
      </mesh>
      <mesh position={[0.82, 1.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.42, 3.1, 0.55]} />
        <meshStandardMaterial color="#253044" roughness={0.9} />
      </mesh>
      <mesh position={[0, 3.0, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.05, 0.38, 0.58]} />
        <meshStandardMaterial color="#2c394f" roughness={0.88} />
      </mesh>
      <mesh position={[0, 2.35, -0.05]}>
        <planeGeometry args={[1.25, 1.05]} />
        <meshStandardMaterial
          color="#78cfff"
          emissive="#3e9dce"
          emissiveIntensity={0.65}
          transparent
          opacity={0.34}
        />
      </mesh>
    </group>
  )
}

function ArchiveSeal() {
  const group = useRef<Group>(null)
  useFrame((state) => {
    if (!group.current) return
    group.current.rotation.z = state.clock.elapsedTime * 0.04
  })

  return (
    <group ref={group} position={[0, 0.035, -0.15]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh>
        <ringGeometry args={[2.0, 2.06, 80]} />
        <meshStandardMaterial color="#d5b467" emissive="#bd8d34" emissiveIntensity={0.55} transparent opacity={0.7} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 4]}>
        <ringGeometry args={[1.45, 1.48, 8]} />
        <meshStandardMaterial color="#74d7ff" emissive="#4cbbe7" emissiveIntensity={0.35} transparent opacity={0.52} />
      </mesh>
    </group>
  )
}

function MissionBoard() {
  return (
    <group position={[0, 0.15, 0]}>
      <mesh position={[0, 1.35, 0]} castShadow>
        <boxGeometry args={[2.0, 1.55, 0.14]} />
        <meshStandardMaterial color="#432f1d" roughness={0.82} />
      </mesh>
      {[-0.58, 0, 0.58].map((x, index) => (
        <mesh key={x} position={[x, 1.38, 0.09]} rotation={[0, 0, (index - 1) * 0.05]}>
          <planeGeometry args={[0.46, 0.8]} />
          <meshStandardMaterial
            color={['#e9dca9', '#d9c4ff', '#bce9f4'][index]}
            emissive={['#9c7a24', '#6d4ac3', '#267f9b'][index]}
            emissiveIntensity={0.12}
          />
        </mesh>
      ))}
    </group>
  )
}

function HoloChart() {
  const group = useRef<Group>(null)
  useFrame((state) => {
    if (group.current) group.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.35) * 0.18
  })

  return (
    <group ref={group} position={[0, 0.25, 0]}>
      {[0.7, 1.25, 0.9, 1.55, 1.1].map((height, index) => (
        <mesh key={index} position={[-0.78 + index * 0.39, height / 2, 0]}>
          <boxGeometry args={[0.22, height, 0.22]} />
          <meshStandardMaterial color="#58d8ff" emissive="#35b9e8" emissiveIntensity={0.62} transparent opacity={0.62} />
        </mesh>
      ))}
    </group>
  )
}

function StationProp({ station, hovered }: { station: Station; hovered: boolean }) {
  const glow = hovered ? station.color : undefined

  switch (station.id) {
    case 'collection':
      return (
        <SafeModel
          url={modelUrl('bookshelf.glb')}
          position={[0, 0, 0]}
          scale={1.13}
          rotation={[0, 0.22, 0]}
          glow={glow}
          fallback={<FallbackShelf position={[0, 0, 0]} />}
        />
      )
    case 'search':
      return (
        <group>
          <SafeModel url={modelUrl('table.glb')} position={[0, 0, 0]} scale={1.55} glow={glow} />
          <Float speed={1.25} floatIntensity={0.12} rotationIntensity={0.08}>
            <SafeModel url={modelUrl('open-book.glb')} position={[0.05, 0.72, 0]} scale={1.25} glow={glow} />
          </Float>
          <SafeModel url={modelUrl('lamp.glb')} position={[-0.95, 0, -0.05]} scale={1.0} />
        </group>
      )
    case 'missions':
      return <MissionBoard />
    case 'shelving':
      return (
        <SafeModel
          url={modelUrl('small-bookshelf.glb')}
          position={[0, 0, 0]}
          scale={1.45}
          rotation={[0, -0.28, 0]}
          glow={glow}
          fallback={<FallbackShelf position={[0, 0, 0]} />}
        />
      )
    case 'inventory':
      return (
        <group>
          <SafeModel url={modelUrl('rug.glb')} position={[0, 0.015, 0]} scale={1.8} />
          <SafeModel url={modelUrl('book-stack.glb')} position={[0, 0.15, 0]} scale={1.42} glow={glow} />
          <SafeModel url={modelUrl('chair.glb')} position={[0.8, 0, 0.25]} rotation={[0, -0.65, 0]} scale={1.15} />
        </group>
      )
    case 'stats':
      return <HoloChart />
    default:
      return null
  }
}

function InteractiveStation({ station, onSelect }: { station: Station; onSelect: (station: Station) => void }) {
  const [hovered, setHovered] = useState(false)
  const group = useRef<Group>(null)

  useEffect(() => {
    if (!hovered) return
    const previous = document.body.style.cursor
    document.body.style.cursor = 'pointer'
    return () => {
      document.body.style.cursor = previous
    }
  }, [hovered])

  useFrame((state) => {
    if (!group.current) return
    const targetScale = hovered ? 1.045 : 1
    group.current.scale.x = THREE.MathUtils.lerp(group.current.scale.x, targetScale, 0.14)
    group.current.scale.y = THREE.MathUtils.lerp(group.current.scale.y, targetScale, 0.14)
    group.current.scale.z = THREE.MathUtils.lerp(group.current.scale.z, targetScale, 0.14)
    group.current.position.y = station.position[1] + Math.sin(state.clock.elapsedTime * 1.4 + Number(station.index)) * 0.012
  })

  return (
    <group
      ref={group}
      position={station.position}
      onPointerOver={(event) => {
        event.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={(event) => {
        event.stopPropagation()
        setHovered(false)
      }}
      onClick={(event) => {
        event.stopPropagation()
        onSelect(station)
      }}
    >
      <StationProp station={station} hovered={hovered} />

      <mesh position={[0, 0.055, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.92, 1.05, 64]} />
        <meshStandardMaterial
          color={station.color}
          emissive={station.color}
          emissiveIntensity={hovered ? 1.1 : 0.42}
          transparent
          opacity={hovered ? 0.95 : 0.48}
        />
      </mesh>
      <pointLight position={[0, 1.15, 0]} color={station.color} intensity={hovered ? 2.0 : 0.65} distance={4.3} />

      <mesh position={[0, 1.05, 0]}>
        <cylinderGeometry args={[1.12, 1.12, 2.2, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <Html center position={[0, 2.25, 0]} distanceFactor={8.5} wrapperClass="world-station-html" style={{ pointerEvents: 'none' }}>
        <div className={`world-station-label${hovered ? ' is-hovered' : ''}`} style={{ '--station-color': station.color } as CSSProperties}>
          <span>{station.index}</span>
          <div>
            <strong>{station.title}</strong>
            <small>{station.subtitle}</small>
          </div>
          <b aria-hidden="true">↗</b>
        </div>
      </Html>
    </group>
  )
}

function FocusScene({ page }: { page: PageId }) {
  if (page === 'collection') {
    return (
      <group>
        {[-3.2, -1.05, 1.05, 3.2].map((x, index) => (
          <SafeModel
            key={x}
            url={modelUrl(index % 2 === 0 ? 'bookshelf.glb' : 'bookcase.glb')}
            position={[x, 0, -1.4 - Math.abs(x) * 0.08]}
            scale={index % 2 === 0 ? 1.2 : 1.35}
            rotation={[0, -x * 0.035, 0]}
            fallback={<FallbackShelf position={[x, 0, -1.4]} />}
          />
        ))}
      </group>
    )
  }

  if (page === 'search') {
    return (
      <group>
        <SafeModel url={modelUrl('table.glb')} position={[0, 0, 0]} scale={1.75} />
        <Float speed={1.2} floatIntensity={0.16}>
          <SafeModel url={modelUrl('open-book.glb')} position={[0, 0.8, 0]} scale={1.45} glow="#5ed4ff" />
        </Float>
        <SafeModel url={modelUrl('lamp.glb')} position={[-1.3, 0, 0]} scale={1.15} />
      </group>
    )
  }

  if (page === 'detail') {
    return (
      <Float speed={1.05} floatIntensity={0.28} rotationIntensity={0.12}>
        <SafeModel url={modelUrl('open-book.glb')} position={[0, 1.05, 0]} scale={2.15} glow="#d7b66a" />
      </Float>
    )
  }

  if (page === 'missions') return <MissionBoard />
  if (page === 'inventory') return <StationProp station={stations[4]} hovered={false} />
  if (page === 'stats') return <HoloChart />

  if (page === 'shelving') {
    return (
      <group>
        {[-3.2, -1.05, 1.05, 3.2].map((x, index) => (
          <SafeModel
            key={x}
            url={modelUrl(index % 2 === 0 ? 'bookshelf.glb' : 'small-bookshelf.glb')}
            position={[x, 0, index % 2 === 0 ? -1.0 : 1.1]}
            scale={index % 2 === 0 ? 1.15 : 1.35}
            fallback={<FallbackShelf position={[x, 0, index % 2 === 0 ? -1.0 : 1.1]} />}
          />
        ))}
      </group>
    )
  }

  return null
}

function SceneContent({ page, interactive, onSelect }: { page: PageId; interactive: boolean; onSelect: (station: Station) => void }) {
  const hall = useRef<Group>(null)

  const cameraTarget = useMemo(() => {
    switch (page) {
      case 'lobby':
        return { position: [0, 3.15, 8.8] as [number, number, number], lookAt: [0, 1.0, -0.6] as [number, number, number] }
      case 'collection':
        return { position: [0, 2.5, 7.0] as [number, number, number], lookAt: [0, 1.0, -0.8] as [number, number, number] }
      case 'search':
        return { position: [1.15, 2.0, 5.3] as [number, number, number], lookAt: [0, 0.9, 0] as [number, number, number] }
      case 'detail':
        return { position: [0, 1.65, 3.7] as [number, number, number], lookAt: [0, 0.95, 0] as [number, number, number] }
      case 'shelving':
        return { position: [0, 5.2, 8.1] as [number, number, number], lookAt: [0, 0.5, 0] as [number, number, number] }
      default:
        return { position: [0, 2.45, 6.2] as [number, number, number], lookAt: [0, 0.95, 0] as [number, number, number] }
    }
  }, [page])

  useFrame((state) => {
    const parallaxX = interactive ? state.pointer.x * 0.42 : 0
    const parallaxY = interactive ? state.pointer.y * 0.14 : 0
    state.camera.position.x = THREE.MathUtils.lerp(state.camera.position.x, cameraTarget.position[0] + parallaxX, 0.045)
    state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, cameraTarget.position[1] + parallaxY, 0.045)
    state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, cameraTarget.position[2], 0.045)
    state.camera.lookAt(cameraTarget.lookAt[0], cameraTarget.lookAt[1], cameraTarget.lookAt[2])

    if (hall.current && page === 'lobby') {
      hall.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.12) * 0.018
    }
  })

  return (
    <>
      <color attach="background" args={['#070b13']} />
      <fog attach="fog" args={['#070b13', 9, 24]} />
      <ambientLight intensity={0.42} />
      <hemisphereLight args={['#8fbce3', '#1a130d', 0.48]} />
      <directionalLight position={[4.5, 8, 5]} intensity={1.7} color="#fff0cf" castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[0, 4.2, -2.8]} intensity={2.0} color="#5cbde7" distance={13} />
      <pointLight position={[-4.8, 2.4, 2.4]} intensity={1.0} color="#d9a84d" distance={9} />
      <pointLight position={[4.8, 2.4, 2.4]} intensity={1.0} color="#8c6eff" distance={9} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[11.5, 96]} />
        <meshStandardMaterial color="#111722" roughness={0.93} metalness={0.06} />
      </mesh>
      <mesh position={[0, -0.02, -4.9]} receiveShadow>
        <boxGeometry args={[17, 6.5, 0.38]} />
        <meshStandardMaterial color="#151d2a" roughness={0.9} />
      </mesh>
      <mesh position={[-8.2, 2.7, 0]} receiveShadow>
        <boxGeometry args={[0.36, 5.4, 13]} />
        <meshStandardMaterial color="#111924" roughness={0.94} />
      </mesh>
      <mesh position={[8.2, 2.7, 0]} receiveShadow>
        <boxGeometry args={[0.36, 5.4, 13]} />
        <meshStandardMaterial color="#111924" roughness={0.94} />
      </mesh>

      <StoneArch x={-4.5} />
      <StoneArch x={0} />
      <StoneArch x={4.5} />
      <ArchiveSeal />
      <Sparkles count={52} scale={[15, 6, 12]} size={1.7} speed={0.22} color="#cbdcf4" opacity={0.42} />
      <ContactShadows position={[0, 0.025, 0]} opacity={0.42} scale={17} blur={2.6} far={8} />

      <group ref={hall}>
        {page === 'lobby'
          ? stations.map((station) => (
              <InteractiveStation key={station.id} station={station} onSelect={onSelect} />
            ))
          : <FocusScene page={page} />}
      </group>
    </>
  )
}

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
].forEach((file) => useGLTF.preload(modelUrl(file)))

export function ThreeScene() {
  const page = useGameStore((state) => state.page)
  const setPage = useGameStore((state) => state.setPage)
  const quality = useGameStore((state) => state.settings.quality)
  const location = useLocation()
  const navigate = useNavigate()
  const interactive = page === 'lobby' && location.pathname === '/'
  const dpr = quality === 'high'
    ? ([1, 1.55] as [number, number])
    : quality === 'medium'
      ? ([1, 1.25] as [number, number])
      : ([1, 1] as [number, number])

  const selectStation = (station: Station) => {
    setPage(station.id)
    navigate(station.path)
  }

  return (
    <div
      className={`scene-layer archive-scene${interactive ? ' is-interactive' : ''}`}
      aria-hidden={!interactive}
      aria-label={interactive ? '클릭 가능한 3D 장서관리 지휘실' : undefined}
    >
      <Canvas
        shadows={quality !== 'low'}
        dpr={dpr}
        camera={{ position: [0, 3.15, 8.8], fov: 42 }}
        gl={{ antialias: quality !== 'low', alpha: false, powerPreference: 'high-performance' }}
      >
        <SceneContent page={page} interactive={interactive} onSelect={selectStation} />
      </Canvas>
    </div>
  )
}
