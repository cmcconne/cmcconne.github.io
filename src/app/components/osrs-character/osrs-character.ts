import {
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  input,
  viewChild,
} from '@angular/core';
import {
  Box3,
  CanvasTexture,
  CircleGeometry,
  Color,
  ColorManagement,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';

// OSRS PLY vertex colours are authored flat/sRGB; skip linear conversion so
// they render bright, matching RuneProfile's `flat` renderer look.
ColorManagement.enabled = false;

/**
 * Native three.js render of a RuneProfile player (+ pet) PLY model.
 * Ports the essential logic from RuneProfile's character.tsx: load the
 * server-baked PLY geometry, draw it unlit with vertex colours, and give it
 * a gentle turntable sway with a soft ground shadow.
 */
@Component({
  selector: 'app-osrs-character',
  template: `<canvas #canvas class="character-canvas"></canvas>`,
  styles: [
    `:host { display: block; width: 100%; height: 100%; }
     .character-canvas { display: block; width: 100%; height: 100%; }`,
  ],
})
export class OsrsCharacterComponent implements OnDestroy {
  readonly playerUrl = input('/models/osrs-player.ply');
  readonly petUrl = input<string | null>(null);

  private readonly canvasRef =
    viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  private renderer?: WebGLRenderer;
  private frameId = 0;
  private resizeObs?: ResizeObserver;
  private startTime = 0;

  // Match RuneProfile's transform constants.
  private readonly SCALE = 0.028;

  constructor() {
    afterNextRender(() => void this.init());
  }

  private async init(): Promise<void> {
    const canvas = this.canvasRef().nativeElement;
    const host = canvas.parentElement ?? canvas;

    const scene = new Scene();
    const camera = new PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.set(0, 0, 5);

    const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer = renderer;

    // vertexColors are multiplied by material.color — dim slightly so the
    // flat colours aren't blown out.
    const material = new MeshBasicMaterial({
      vertexColors: true,
      color: new Color(0.82, 0.82, 0.82),
    });
    const loader = new PLYLoader();
    const inner = new Group();

    // Player
    const playerGeo = await loader.loadAsync(this.playerUrl());
    const player = new Mesh(playerGeo, material);
    player.scale.setScalar(this.SCALE);
    player.position.set(0, -3, 0);
    player.rotation.set(-1.55, 0, 0.1);
    inner.add(player, this.makeShadow(0, -3.01, 0));

    // Pet (optional)
    let pet: Mesh | undefined;
    const petUrl = this.petUrl();
    if (petUrl) {
      try {
        const petGeo = await loader.loadAsync(petUrl);
        pet = new Mesh(petGeo, material);
        pet.scale.setScalar(this.SCALE);
        pet.position.set(2.5, -3.3, -3);
        pet.rotation.set(-1.55, 0, 0.1);
        inner.add(pet, this.makeShadow(2.5, -3.31, -3));
      } catch {
        /* no pet — ignore */
      }
    }

    // Centre the content at the origin (equivalent to drei's <Center>).
    const box = new Box3().setFromObject(inner);
    const center = box.getCenter(new Vector3());
    const size = box.getSize(new Vector3());
    const halfW = size.x / 2;
    const halfH = size.y / 2;
    inner.position.sub(center);
    scene.add(inner);

    // Auto-frame: pull the camera back just far enough to fit the figure's
    // width/height for the current aspect ratio (tight, small padding).
    const frame = () => {
      const vFov = (camera.fov * Math.PI) / 180;
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
      const dist = Math.max(
        halfH / Math.tan(vFov / 2),
        halfW / Math.tan(hFov / 2),
      );
      camera.position.z = dist * 1.15;
      camera.updateProjectionMatrix();
    };

    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      frame();
    };
    resize();
    this.resizeObs = new ResizeObserver(resize);
    this.resizeObs.observe(host);

    const animate = (t: number) => {
      if (!this.startTime) this.startTime = t;
      const y = Math.sin((t - this.startTime) / 1000);
      player.rotation.z = y;
      if (pet) pet.rotation.z = y / 1.5;
      renderer.render(scene, camera);
      this.frameId = requestAnimationFrame(animate);
    };
    this.frameId = requestAnimationFrame(animate);
  }

  /** Soft radial ground shadow. */
  private makeShadow(x: number, y: number, z: number): Mesh {
    const size = 128;
    const cvs = document.createElement('canvas');
    cvs.width = cvs.height = size;
    const ctx = cvs.getContext('2d')!;
    const grad = ctx.createRadialGradient(
      size / 2, size / 2, 0,
      size / 2, size / 2, size / 2,
    );
    grad.addColorStop(0, 'rgba(0,0,0,0.4)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    const mesh = new Mesh(
      new CircleGeometry(1, 32),
      new MeshBasicMaterial({ map: new CanvasTexture(cvs), transparent: true }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.scale.setScalar(1.4);
    return mesh;
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.frameId);
    this.resizeObs?.disconnect();
    this.renderer?.dispose();
  }
}
