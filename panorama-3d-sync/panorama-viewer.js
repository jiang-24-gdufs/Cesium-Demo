/**
 * PanoramaViewer - 基于 Three.js 的 360 全景渲染器
 * 将等距圆柱投影(Equirectangular)纹理映射到球体内壁，
 * 相机位于球心，通过鼠标/触摸控制 heading 和 pitch。
 */
export class PanoramaViewer {
  constructor(container) {
    this._container = container;
    this._heading = 0;
    this._pitch = 0;
    this._fov = 75;

    this._isDragging = false;
    this._prevMouse = { x: 0, y: 0 };
    this._onChangeCallbacks = [];
    this._disposed = false;

    this._pitchMin = -85;
    this._pitchMax = 85;
    this._indoorMode = false;

    this._init();
    this._bindEvents();
    this._animate();
  }

  _init() {
    const width = this._container.clientWidth;
    const height = this._container.clientHeight;

    this._scene = new THREE.Scene();

    this._camera = new THREE.PerspectiveCamera(this._fov, width / height, 0.1, 1000);
    this._camera.position.set(0, 0, 0);

    this._renderer = new THREE.WebGLRenderer({ antialias: true });
    this._renderer.setSize(width, height);
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this._container.appendChild(this._renderer.domElement);

    this._createSphere();
    this._addCrosshair();

    this._resizeObserver = new ResizeObserver(() => this._onResize());
    this._resizeObserver.observe(this._container);
  }

  _createSphere() {
    const geometry = new THREE.SphereGeometry(500, 60, 40);
    geometry.scale(-1, 1, 1);

    this._sphereMaterial = new THREE.MeshBasicMaterial({
      color: 0x222244,
    });

    this._sphere = new THREE.Mesh(geometry, this._sphereMaterial);
    this._scene.add(this._sphere);

    this.loadPanorama('indoor');
  }

  _addCrosshair() {
    const crosshair = document.createElement('div');
    crosshair.className = 'pano-crosshair';
    this._container.style.position = 'relative';
    this._container.appendChild(crosshair);
  }

  /**
   * 加载全景纹理
   * 使用程序生成的全景图作为默认纹理，避免外部资源依赖
   */
  loadPanorama(type) {
    const canvas = this._generatePanoramaTexture(type);
    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    this._sphereMaterial.map = texture;
    this._sphereMaterial.color.set(0xffffff);
    this._sphereMaterial.needsUpdate = true;
  }

  /**
   * 程序生成全景图纹理
   * 生成带有方位标记、地面、天空的模拟全景图
   */
  _generatePanoramaTexture(type) {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    switch (type) {
      case 'outdoor':
        this._drawOutdoorPanorama(ctx, canvas.width, canvas.height);
        break;
      case 'indoor':
        this._drawIndoorPanorama(ctx, canvas.width, canvas.height);
        break;
      default:
        this._drawDefaultPanorama(ctx, canvas.width, canvas.height);
        break;
    }

    return canvas;
  }

  _drawDefaultPanorama(ctx, w, h) {
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.5);
    skyGrad.addColorStop(0, '#0a1628');
    skyGrad.addColorStop(0.4, '#1a3a5c');
    skyGrad.addColorStop(1, '#4a7faa');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h * 0.5);

    const groundGrad = ctx.createLinearGradient(0, h * 0.5, 0, h);
    groundGrad.addColorStop(0, '#3a6040');
    groundGrad.addColorStop(0.5, '#2d4a30');
    groundGrad.addColorStop(1, '#1a2e1c');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, h * 0.5, w, h * 0.5);

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i < w; i += w / 36) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, h);
      ctx.stroke();
    }
    for (let j = 0; j < h; j += h / 18) {
      ctx.beginPath();
      ctx.moveTo(0, j);
      ctx.lineTo(w, j);
      ctx.stroke();
    }

    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const colors = ['#ff4444', '#ff8844', '#ffff44', '#44ff44', '#4444ff', '#8844ff', '#ff44ff', '#ff4488'];
    for (let i = 0; i < 8; i++) {
      const x = (i / 8) * w;
      ctx.fillStyle = colors[i];
      ctx.font = 'bold 48px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(directions[i], x + w / 16, h * 0.48);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '24px sans-serif';
      ctx.fillText(`${i * 45}°`, x + w / 16, h * 0.53);
    }

    this._drawStars(ctx, w, h * 0.35, 100);

    this._drawBuildings(ctx, w, h, 0.45, 0.52, 15, '#334455', '#445566');
  }

  _drawOutdoorPanorama(ctx, w, h) {
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.55);
    skyGrad.addColorStop(0, '#87CEEB');
    skyGrad.addColorStop(0.5, '#B0E0E6');
    skyGrad.addColorStop(1, '#E0F0FF');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h * 0.55);

    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(w * 0.15, h * 0.15, 40, 0, Math.PI * 2);
    ctx.fill();
    const sunGrad = ctx.createRadialGradient(w * 0.15, h * 0.15, 40, w * 0.15, h * 0.15, 120);
    sunGrad.addColorStop(0, 'rgba(255,215,0,0.3)');
    sunGrad.addColorStop(1, 'rgba(255,215,0,0)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(w * 0.15, h * 0.15, 120, 0, Math.PI * 2);
    ctx.fill();

    this._drawMountains(ctx, w, h);

    const groundGrad = ctx.createLinearGradient(0, h * 0.55, 0, h);
    groundGrad.addColorStop(0, '#7CCD7C');
    groundGrad.addColorStop(0.5, '#5A9F5A');
    groundGrad.addColorStop(1, '#3A6F3A');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, h * 0.55, w, h * 0.45);

    this._drawTrees(ctx, w, h);

    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    for (let i = 0; i < 8; i++) {
      const x = (i / 8) * w;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(directions[i], x + w / 16, h * 0.53);
    }
  }

  _drawIndoorPanorama(ctx, w, h) {
    ctx.fillStyle = '#F5F0E8';
    ctx.fillRect(0, 0, w, h);

    const ceilGrad = ctx.createLinearGradient(0, 0, 0, h * 0.3);
    ceilGrad.addColorStop(0, '#E8E0D0');
    ceilGrad.addColorStop(1, '#F5F0E8');
    ctx.fillStyle = ceilGrad;
    ctx.fillRect(0, 0, w, h * 0.3);

    const floorGrad = ctx.createLinearGradient(0, h * 0.7, 0, h);
    floorGrad.addColorStop(0, '#D4C4A8');
    floorGrad.addColorStop(1, '#B8A88C');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, h * 0.7, w, h * 0.3);

    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1;
    const tileSize = w / 40;
    for (let x = 0; x < w; x += tileSize) {
      for (let y = h * 0.7; y < h; y += tileSize) {
        ctx.strokeRect(x, y, tileSize, tileSize);
      }
    }

    const wallCount = 8;
    const wallWidth = w / wallCount;
    for (let i = 0; i < wallCount; i++) {
      const x = i * wallWidth;

      ctx.strokeStyle = 'rgba(0,0,0,0.06)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, h * 0.2, wallWidth, h * 0.6);

      if (i % 2 === 0) {
        ctx.fillStyle = '#8BA8C8';
        ctx.fillRect(x + wallWidth * 0.2, h * 0.3, wallWidth * 0.6, h * 0.25);
        ctx.strokeStyle = '#6688AA';
        ctx.lineWidth = 3;
        ctx.strokeRect(x + wallWidth * 0.2, h * 0.3, wallWidth * 0.6, h * 0.25);
        ctx.beginPath();
        ctx.moveTo(x + wallWidth * 0.5, h * 0.3);
        ctx.lineTo(x + wallWidth * 0.5, h * 0.55);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#C4A050';
        ctx.fillRect(x + wallWidth * 0.25, h * 0.35, wallWidth * 0.5, h * 0.3);
        ctx.strokeStyle = '#A08040';
        ctx.lineWidth = 3;
        ctx.strokeRect(x + wallWidth * 0.25, h * 0.35, wallWidth * 0.5, h * 0.3);
      }
    }

    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    for (let i = 0; i < 8; i++) {
      const x = (i / 8) * w;
      ctx.fillStyle = 'rgba(100,80,60,0.5)';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(directions[i], x + w / 16, h * 0.68);
    }
  }

  _drawStars(ctx, w, maxY, count) {
    for (let i = 0; i < count; i++) {
      const x = Math.random() * w;
      const y = Math.random() * maxY;
      const r = Math.random() * 2 + 0.5;
      const a = Math.random() * 0.8 + 0.2;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawBuildings(ctx, w, h, yStart, yEnd, count, colorA, colorB) {
    for (let i = 0; i < count; i++) {
      const x = (i / count) * w + Math.random() * (w / count) * 0.5;
      const bw = 20 + Math.random() * 40;
      const bh = 20 + Math.random() * 60;
      const y = h * yEnd - bh;
      ctx.fillStyle = i % 2 === 0 ? colorA : colorB;
      ctx.fillRect(x, y, bw, bh);

      ctx.fillStyle = 'rgba(255,200,50,0.6)';
      for (let wy = y + 5; wy < y + bh - 5; wy += 12) {
        for (let wx = x + 4; wx < x + bw - 4; wx += 10) {
          if (Math.random() > 0.3) {
            ctx.fillRect(wx, wy, 5, 6);
          }
        }
      }
    }
  }

  _drawMountains(ctx, w, h) {
    const layers = [
      { yBase: h * 0.55, maxH: 80, color: '#6B8E6B', segments: 20 },
      { yBase: h * 0.55, maxH: 120, color: '#5A7A5A', segments: 12 },
      { yBase: h * 0.55, maxH: 160, color: '#4A6A4A', segments: 8 },
    ];
    for (const layer of layers) {
      ctx.fillStyle = layer.color;
      ctx.beginPath();
      ctx.moveTo(0, layer.yBase);
      const step = w / layer.segments;
      for (let x = 0; x <= w; x += step) {
        const mh = Math.random() * layer.maxH;
        ctx.lineTo(x, layer.yBase - mh);
      }
      ctx.lineTo(w, layer.yBase);
      ctx.closePath();
      ctx.fill();
    }
  }

  _drawTrees(ctx, w, h) {
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * w;
      const y = h * 0.55 + Math.random() * (h * 0.15);
      const size = 8 + Math.random() * 15;

      ctx.fillStyle = '#5B3A1A';
      ctx.fillRect(x - 2, y, 4, size);

      ctx.fillStyle = `rgb(${40 + Math.random() * 40}, ${100 + Math.random() * 60}, ${30 + Math.random() * 30})`;
      ctx.beginPath();
      ctx.moveTo(x, y - size * 1.5);
      ctx.lineTo(x - size, y);
      ctx.lineTo(x + size, y);
      ctx.closePath();
      ctx.fill();
    }
  }

  _bindEvents() {
    const el = this._renderer.domElement;

    el.addEventListener('pointerdown', (e) => {
      this._isDragging = true;
      this._prevMouse.x = e.clientX;
      this._prevMouse.y = e.clientY;
      el.setPointerCapture(e.pointerId);
    });

    el.addEventListener('pointermove', (e) => {
      if (!this._isDragging) return;
      const dx = e.clientX - this._prevMouse.x;
      const dy = e.clientY - this._prevMouse.y;
      this._prevMouse.x = e.clientX;
      this._prevMouse.y = e.clientY;

      this._heading -= dx * 0.3;
      this._pitch += dy * 0.3;
      this._pitch = Math.max(this._pitchMin, Math.min(this._pitchMax, this._pitch));

      this._heading = ((this._heading % 360) + 360) % 360;

      this._updateCamera();
      this._fireChange('panorama');
    });

    el.addEventListener('pointerup', () => { this._isDragging = false; });
    el.addEventListener('pointercancel', () => { this._isDragging = false; });

    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this._fov += e.deltaY * 0.05;
      this._fov = Math.max(30, Math.min(120, this._fov));
      this._camera.fov = this._fov;
      this._camera.updateProjectionMatrix();
      this._fireChange('panorama');
    }, { passive: false });
  }

  _updateCamera() {
    const headingRad = THREE.MathUtils.degToRad(this._heading);
    const pitchRad = THREE.MathUtils.degToRad(this._pitch);

    const target = new THREE.Vector3(
      Math.cos(pitchRad) * Math.sin(headingRad),
      Math.sin(pitchRad),
      Math.cos(pitchRad) * Math.cos(headingRad)
    );

    this._camera.lookAt(target);
  }

  _animate() {
    if (this._disposed) return;
    requestAnimationFrame(() => this._animate());
    this._renderer.render(this._scene, this._camera);
  }

  _onResize() {
    const w = this._container.clientWidth;
    const h = this._container.clientHeight;
    if (w === 0 || h === 0) return;
    this._camera.aspect = w / h;
    this._camera.updateProjectionMatrix();
    this._renderer.setSize(w, h);
  }

  /** 外部设置视角（由 SyncController 调用） */
  setView(heading, pitch) {
    this._heading = ((heading % 360) + 360) % 360;
    this._pitch = Math.max(this._pitchMin, Math.min(this._pitchMax, pitch));
    this._updateCamera();
  }

  /** 获取当前视角状态 */
  getState() {
    return {
      heading: this._heading,
      pitch: this._pitch,
      fov: this._fov,
      indoorMode: this._indoorMode,
    };
  }

  /**
   * 设置室内模式
   * 室内模式下收紧 pitch 范围，避免穿透天花板/地板
   */
  setIndoorMode(enabled, options = {}) {
    this._indoorMode = enabled;
    if (enabled) {
      this._pitchMin = options.pitchMin ?? -60;
      this._pitchMax = options.pitchMax ?? 60;
    } else {
      this._pitchMin = -85;
      this._pitchMax = 85;
    }
    this._pitch = Math.max(this._pitchMin, Math.min(this._pitchMax, this._pitch));
    this._updateCamera();
  }

  get indoorMode() { return this._indoorMode; }
  get pitchRange() { return { min: this._pitchMin, max: this._pitchMax }; }

  /** 注册视角变化回调 */
  onChange(callback) {
    this._onChangeCallbacks.push(callback);
  }

  _fireChange(source) {
    const state = this.getState();
    for (const cb of this._onChangeCallbacks) {
      cb(state, source);
    }
  }

  /** 强制刷新尺寸 */
  resize() {
    this._onResize();
  }

  dispose() {
    this._disposed = true;
    this._resizeObserver.disconnect();
    this._renderer.dispose();
    this._sphereMaterial.dispose();
    if (this._sphereMaterial.map) {
      this._sphereMaterial.map.dispose();
    }
    this._sphere.geometry.dispose();
    this._container.removeChild(this._renderer.domElement);
  }
}
