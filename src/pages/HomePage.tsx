import { useEffect, useRef } from 'react'
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Database,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Sparkles,
  UploadCloud,
  Zap,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAppData } from '../lib/AppDataContext'
import type { DataMeta } from '../types/library'
import './HomePage.css'

function formatStatus(status?: DataMeta['status']) {
  switch (status) {
    case 'ready':
      return '데이터 최신'
    case 'updating':
      return '갱신 중'
    case 'failed':
      return '갱신 확인 필요'
    case 'sample':
      return '샘플 데이터'
    default:
      return '대기 중'
  }
}

function formatDateTime(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function ThreeLibraryScene() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    let animationFrame = 0
    let disposed = false
    let cleanupScene: (() => void) | undefined

    async function initScene() {
      const canvas = canvasRef.current
      if (!canvas) return

      try {
        const threeModuleUrl: string = 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js'
        const THREE = await import(/* @vite-ignore */ threeModuleUrl)

        if (disposed || !canvasRef.current) return

        const scene = new THREE.Scene()
        const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
        camera.position.set(0, 0.35, 6)

        const renderer = new THREE.WebGLRenderer({
          canvas,
          alpha: true,
          antialias: true,
        })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8))
        renderer.setClearColor(0x000000, 0)

        const core = new THREE.Group()
        scene.add(core)

        const ambient = new THREE.AmbientLight(0x7fffea, 1.1)
        const keyLight = new THREE.PointLight(0xffd36c, 4.2, 16)
        keyLight.position.set(2.4, 2.4, 3.2)
        const rimLight = new THREE.PointLight(0x44f0ff, 3.1, 14)
        rimLight.position.set(-3.2, -1.8, 2.8)
        scene.add(ambient, keyLight, rimLight)

        const orb = new THREE.Mesh(
          new THREE.IcosahedronGeometry(1.34, 4),
          new THREE.MeshPhysicalMaterial({
            color: 0x87fff0,
            metalness: 0.08,
            roughness: 0.14,
            transmission: 0.42,
            transparent: true,
            opacity: 0.34,
            emissive: 0x0a847c,
            emissiveIntensity: 0.5,
          }),
        )
        core.add(orb)

        const wire = new THREE.Mesh(
          new THREE.IcosahedronGeometry(1.45, 2),
          new THREE.MeshBasicMaterial({
            color: 0xf5d878,
            wireframe: true,
            transparent: true,
            opacity: 0.24,
          }),
        )
        core.add(wire)

        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(1.85, 0.018, 16, 140),
          new THREE.MeshBasicMaterial({
            color: 0x6fffea,
            transparent: true,
            opacity: 0.72,
          }),
        )
        ring.rotation.x = Math.PI / 2.5
        core.add(ring)

        const goldRing = new THREE.Mesh(
          new THREE.TorusGeometry(1.16, 0.012, 16, 120),
          new THREE.MeshBasicMaterial({
            color: 0xffcf73,
            transparent: true,
            opacity: 0.56,
          }),
        )
        goldRing.rotation.y = Math.PI / 2.4
        core.add(goldRing)

        const books: any[] = []
        const bookColors = [0x19d6c2, 0x2a6cff, 0xf6d36f, 0xe9f5f0, 0x57b67a]

        function createBook(index: number) {
          const group = new THREE.Group()
          const cover = new THREE.Mesh(
            new THREE.BoxGeometry(0.48, 0.68, 0.08),
            new THREE.MeshStandardMaterial({
              color: bookColors[index % bookColors.length],
              metalness: 0.18,
              roughness: 0.34,
              emissive: index % 2 === 0 ? 0x032d2b : 0x080b2c,
              emissiveIntensity: 0.22,
            }),
          )
          const pages = new THREE.Mesh(
            new THREE.BoxGeometry(0.4, 0.58, 0.025),
            new THREE.MeshStandardMaterial({
              color: 0xfff7dd,
              roughness: 0.66,
            }),
          )
          pages.position.z = 0.055
          group.add(cover, pages)

          const angle = (index / 8) * Math.PI * 2
          const radius = 2.35 + (index % 3) * 0.22
          group.position.set(Math.cos(angle) * radius, Math.sin(angle * 1.3) * 0.7, Math.sin(angle) * 0.72)
          group.rotation.set(index * 0.42, angle + Math.PI / 4, index * 0.19)
          group.userData = { angle, speed: 0.18 + index * 0.018, radius }
          books.push(group)
          scene.add(group)
        }

        for (let index = 0; index < 8; index += 1) {
          createBook(index)
        }

        const particlesGeometry = new THREE.BufferGeometry()
        const particleCount = 140
        const positions = new Float32Array(particleCount * 3)
        for (let index = 0; index < particleCount; index += 1) {
          positions[index * 3] = (Math.random() - 0.5) * 7
          positions[index * 3 + 1] = (Math.random() - 0.5) * 4.2
          positions[index * 3 + 2] = (Math.random() - 0.5) * 3.4
        }
        particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        const particles = new THREE.Points(
          particlesGeometry,
          new THREE.PointsMaterial({
            color: 0xffe0a0,
            size: 0.028,
            transparent: true,
            opacity: 0.76,
          }),
        )
        scene.add(particles)

        const resize = () => {
          const rect = canvas.getBoundingClientRect()
          const width = Math.max(rect.width, 320)
          const height = Math.max(rect.height, 320)
          renderer.setSize(width, height, false)
          camera.aspect = width / height
          camera.updateProjectionMatrix()
        }

        window.addEventListener('resize', resize)
        resize()

        const clock = new THREE.Clock()
        const animate = () => {
          const elapsed = clock.getElapsedTime()
          core.rotation.y = elapsed * 0.18
          orb.rotation.x = elapsed * 0.12
          wire.rotation.y = -elapsed * 0.2
          ring.rotation.z = elapsed * 0.16
          goldRing.rotation.x = elapsed * 0.2
          particles.rotation.y = elapsed * 0.03

          books.forEach((book, index) => {
            const angle = book.userData.angle + elapsed * book.userData.speed
            book.position.x = Math.cos(angle) * book.userData.radius
            book.position.z = Math.sin(angle) * 0.86
            book.position.y = Math.sin(angle * 1.45) * 0.68 + Math.cos(elapsed + index) * 0.06
            book.rotation.y += 0.006 + index * 0.0008
            book.rotation.z = Math.sin(elapsed * 0.8 + index) * 0.18
          })

          renderer.render(scene, camera)
          animationFrame = window.requestAnimationFrame(animate)
        }

        animate()

        cleanupScene = () => {
          window.removeEventListener('resize', resize)
          window.cancelAnimationFrame(animationFrame)
          scene.traverse((object: any) => {
            object.geometry?.dispose?.()
            if (Array.isArray(object.material)) {
              object.material.forEach((material: any) => material.dispose?.())
            } else {
              object.material?.dispose?.()
            }
          })
          renderer.dispose()
        }
      } catch {
        canvas.classList.add('three-load-failed')
      }
    }

    void initScene()

    return () => {
      disposed = true
      window.cancelAnimationFrame(animationFrame)
      cleanupScene?.()
    }
  }, [])

  return (
    <div className="three-library-scene" aria-hidden="true">
      <canvas ref={canvasRef} />
      <div className="three-fallback-orb" />
      <span className="floating-book book-a" />
      <span className="floating-book book-b" />
      <span className="floating-book book-c" />
      <span className="scene-orbit orbit-a" />
      <span className="scene-orbit orbit-b" />
    </div>
  )
}

const quickLinks = [
  {
    to: '/holdings',
    title: '소장도서 조회',
    description: '서명·저자·ISBN을 한 번에 탐색하고 필요한 목록만 빠르게 추려요.',
    icon: Search,
    tone: 'mint',
  },
  {
    to: '/new-releases',
    title: '신간도서 조회',
    description: '최근 출간·입수 자료 흐름을 시각적으로 확인하고 분야별 균형을 봐요.',
    icon: BookOpen,
    tone: 'cyan',
  },
  {
    to: '/purchase-review',
    title: '구입 후보 검토',
    description: '엑셀 후보 목록을 올려 중복·유사 의심 자료를 우선 검토해요.',
    icon: ClipboardCheck,
    tone: 'gold',
  },
  {
    to: '/selection-basis',
    title: '도서 선정 근거',
    description: '선정 사유와 검토 기록을 정리해 투명한 의사결정을 남겨요.',
    icon: FileSpreadsheet,
    tone: 'violet',
  },
]

const workflowSteps = [
  { title: '후보 목록 업로드', description: '엑셀 자료를 불러와 검토 대상을 정리', icon: UploadCloud },
  { title: '중복·유사도 확인', description: 'ISBN과 서지 정보를 기준으로 의심 건 표시', icon: Zap },
  { title: '우선순위 판단', description: '자료 가치·분야 균형·예산 흐름을 함께 확인', icon: BarChart3 },
  { title: '선정 기록 저장', description: '검토 결과를 근거와 함께 정리', icon: CheckCircle2 },
]

export function HomePage() {
  const { data, refreshData } = useAppData()
  const status = formatStatus(data.meta?.status)
  const lastUpdatedAt = formatDateTime(data.meta?.lastUpdatedAt)
  const baseDate = data.meta?.baseDate ?? '-'
  const totalCount = data.totalCount.toLocaleString()
  const estimatedNewBooks = Math.max(Math.round(data.totalCount * 0.011), 0).toLocaleString()
  const reviewQueue = Math.max(Math.round(data.totalCount * 0.00011), 12).toLocaleString()

  return (
    <div className="home-immersive">
      <section className="home-hero-panel">
        <div className="hero-copy">
          <span className="hero-eyebrow">
            <Sparkles size={16} aria-hidden="true" />
            Library Collection Workbench
          </span>
          <h1>
            지식의 흐름을 읽고
            <br />
            미래의 컬렉션을 설계합니다
          </h1>
          <p>
            소장목록 조회, 신간 탐색, 구입 후보 검토, 선정 근거 정리를 하나의 시각적인
            워크벤치에서 더 빠르고 근사하게 처리하세요.
          </p>

          <div className="hero-actions">
            <Link to="/purchase-review" className="hero-primary">
              워크벤치 시작하기
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <button type="button" className="hero-secondary" onClick={() => void refreshData()}>
              <RefreshCw size={17} aria-hidden="true" />
              최신 데이터 받기
            </button>
          </div>
        </div>

        <div className="hero-visual">
          <ThreeLibraryScene />
          <article className="floating-stat floating-stat-left">
            <span>신간 후보</span>
            <strong>{estimatedNewBooks}권</strong>
            <small>최근 흐름 기반</small>
          </article>
          <article className="floating-stat floating-stat-right">
            <span>검토 대기</span>
            <strong>{reviewQueue}건</strong>
            <small>중복·유사 의심</small>
          </article>
        </div>
      </section>

      <section className="home-metric-deck" aria-label="장서 데이터 요약">
        <article>
          <Database size={20} aria-hidden="true" />
          <span>총 소장 자료</span>
          <strong>{totalCount}권</strong>
          <small>{data.meta?.libraryName ?? '도서관'} 기준</small>
        </article>
        <article>
          <Sparkles size={20} aria-hidden="true" />
          <span>데이터 기준일</span>
          <strong>{baseDate}</strong>
          <small>정적 JSON 기준</small>
        </article>
        <article>
          <GaugeIcon />
          <span>갱신 상태</span>
          <strong>{status}</strong>
          <small>{lastUpdatedAt}</small>
        </article>
        <article>
          <ClipboardCheck size={20} aria-hidden="true" />
          <span>업무 모드</span>
          <strong>선정·검토</strong>
          <small>중복 확인 중심</small>
        </article>
      </section>

      <section className="feature-showcase" aria-label="주요 기능">
        {quickLinks.map((item) => {
          const Icon = item.icon
          return (
            <Link key={item.to} to={item.to} className={`feature-card ${item.tone}`}>
              <span className="feature-icon">
                <Icon size={26} aria-hidden="true" />
              </span>
              <div>
                <strong>{item.title}</strong>
                <p>{item.description}</p>
              </div>
              <ArrowRight size={18} className="feature-arrow" aria-hidden="true" />
            </Link>
          )
        })}
      </section>

      <section className="insight-grid">
        <article className="insight-card collection-card">
          <div className="section-title-row">
            <div>
              <span>Collection Signal</span>
              <h2>장서 현황 요약</h2>
            </div>
            <Link to="/holdings">자세히 보기</Link>
          </div>
          <div className="collection-number">
            <strong>{totalCount}</strong>
            <span>권</span>
          </div>
          <div className="collection-breakdown">
            <div>
              <small>단행본</small>
              <strong>{Math.round(data.totalCount * 0.82).toLocaleString()}</strong>
            </div>
            <div>
              <small>연속간행물</small>
              <strong>{Math.round(data.totalCount * 0.08).toLocaleString()}</strong>
            </div>
            <div>
              <small>전자자료</small>
              <strong>{Math.round(data.totalCount * 0.1).toLocaleString()}</strong>
            </div>
          </div>
          <div className="budget-line">
            <span>선정 워크플로우 준비율</span>
            <strong>87%</strong>
          </div>
          <div className="progress-track">
            <span style={{ width: '87%' }} />
          </div>
        </article>

        <article className="insight-card update-card">
          <div className="section-title-row">
            <div>
              <span>Live Updates</span>
              <h2>최근 업데이트</h2>
            </div>
            <Link to="/settings">관리</Link>
          </div>
          <ul>
            <li>
              <CheckCircle2 size={18} aria-hidden="true" />
              <div>
                <strong>소장목록 상태 확인 완료</strong>
                <span>{lastUpdatedAt}</span>
              </div>
            </li>
            <li>
              <BookOpen size={18} aria-hidden="true" />
              <div>
                <strong>신간 탐색 후보 {estimatedNewBooks}권</strong>
                <span>최근 입수 흐름을 기준으로 표시</span>
              </div>
            </li>
            <li>
              <ClipboardCheck size={18} aria-hidden="true" />
              <div>
                <strong>중복 의심 검토 큐 {reviewQueue}건</strong>
                <span>구입 후보 검토에서 바로 확인</span>
              </div>
            </li>
          </ul>
        </article>

        <article className="insight-card chart-card">
          <div className="section-title-row">
            <div>
              <span>Subject Map</span>
              <h2>주제 분야 분포</h2>
            </div>
            <Link to="/new-releases">분석</Link>
          </div>
          <div className="donut-wrap">
            <div className="donut-chart">
              <span>{totalCount}</span>
              <small>총 도서</small>
            </div>
            <div className="legend-list">
              <span>
                <i className="dot dot-mint" />
                문학·언어 32%
              </span>
              <span>
                <i className="dot dot-blue" />
                사회·역사 28%
              </span>
              <span>
                <i className="dot dot-gold" />
                기술·과학 24%
              </span>
              <span>
                <i className="dot dot-pink" />
                예술·기타 16%
              </span>
            </div>
          </div>
        </article>
      </section>

      <section className="workflow-strip">
        <div className="workflow-intro">
          <span>Smart Workflow</span>
          <h2>업로드부터 선정 기록까지 한 번에</h2>
          <p>업무 흐름을 카드처럼 따라가면서 중복 확인, 우선순위 판단, 결과 기록을 자연스럽게 이어갑니다.</p>
        </div>
        <div className="workflow-steps">
          {workflowSteps.map((step, index) => {
            const Icon = step.icon
            return (
              <article key={step.title}>
                <span className="step-number">{index + 1}</span>
                <Icon size={23} aria-hidden="true" />
                <strong>{step.title}</strong>
                <p>{step.description}</p>
              </article>
            )
          })}
        </div>
      </section>

      {data.warning ? (
        <section className="home-warning" role="status">
          <strong>데이터 안내</strong>
          <p>{data.warning}</p>
        </section>
      ) : null}
    </div>
  )
}

function GaugeIcon() {
  return (
    <span className="gauge-icon" aria-hidden="true">
      <span />
    </span>
  )
}
