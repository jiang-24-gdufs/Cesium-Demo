/**
 * UIControls - UI 控件管理
 * 管理工具栏按钮、全景切换、影像图层切换、热点面板、分割线拖拽、状态栏。
 */
export class UIControls {
  constructor(panoramaViewer, cesiumViewer, syncController, indoorBoundsConfig) {
    this._pano = panoramaViewer;
    this._cesium = cesiumViewer;
    this._sync = syncController;
    this._indoorBoundsConfig = indoorBoundsConfig;
    this._boundsVisible = false;

    this._initToolbar();
    this._initHotspotPanel();
    this._initDividerDrag();
    this._initStatusBar();
  }

  _initToolbar() {
    const syncBtn = document.getElementById('btn-sync-toggle');
    syncBtn.classList.add('active');
    syncBtn.addEventListener('click', () => {
      const enabled = this._sync.toggleSync();
      syncBtn.classList.toggle('active', enabled);
      syncBtn.textContent = enabled ? '视角联动: 开' : '视角联动: 关';
    });

    const panoSelect = document.getElementById('select-panorama');
    panoSelect.addEventListener('change', (e) => {
      this._pano.loadPanorama(e.target.value);
    });

    const imagerySelect = document.getElementById('select-imagery');
    imagerySelect.addEventListener('change', (e) => {
      this._switchImagery(e.target.value);
    });

    const resetBtn = document.getElementById('btn-reset-view');
    resetBtn.addEventListener('click', () => {
      this._sync.resetView();
    });

    const overviewBtn = document.getElementById('btn-overview');
    overviewBtn.addEventListener('click', () => {
      window.flyToOverview();
    });

    const flyIndoorBtn = document.getElementById('btn-fly-indoor');
    flyIndoorBtn.addEventListener('click', () => {
      window.flyToIndoor();
    });

    const indoorBtn = document.getElementById('btn-indoor-mode');
    indoorBtn.addEventListener('click', () => {
      const enabled = this._sync.toggleIndoorMode(this._indoorBoundsConfig);
      indoorBtn.classList.toggle('active', enabled);
      indoorBtn.textContent = enabled ? '室内模式: 开' : '室内模式: 关';
      if (!enabled) {
        this._boundsVisible = false;
        boundsBtn.classList.remove('active');
        boundsBtn.textContent = '边界: 隐';
      }
    });

    const boundsBtn = document.getElementById('btn-bounds-vis');
    boundsBtn.addEventListener('click', () => {
      if (!this._sync.indoorMode) return;
      this._boundsVisible = !this._boundsVisible;
      this._sync.toggleBoundsVisualization(this._boundsVisible);
      boundsBtn.classList.toggle('active', this._boundsVisible);
      boundsBtn.textContent = this._boundsVisible ? '边界: 显' : '边界: 隐';
    });

    const tokenInput = document.getElementById('input-token');
    const tokenBtn = document.getElementById('btn-set-token');
    const existingToken = localStorage.getItem('cesium_ion_token');
    if (existingToken) {
      tokenInput.value = existingToken.substring(0, 20) + '...';
    }
    tokenBtn.addEventListener('click', () => {
      const token = tokenInput.value.trim();
      if (token && !token.endsWith('...')) {
        window.setCesiumToken(token);
      }
    });
  }

  _switchImagery(type) {
    const createProvider = () => {
      switch (type) {
        case 'arcgis':
          return new Cesium.ArcGisMapServerImageryProvider({
            url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',
          });
        case 'osm':
        default:
          return new Cesium.OpenStreetMapImageryProvider({
            url: 'https://tile.openstreetmap.org/',
          });
      }
    };
    this._sync.switchImagery(createProvider);
  }

  _initHotspotPanel() {
    const hotspots = [
      { name: '正北 0°', heading: 0, pitch: 0 },
      { name: '正东 90°', heading: 90, pitch: 0 },
      { name: '正南 180°', heading: 180, pitch: 0 },
      { name: '正西 270°', heading: 270, pitch: 0 },
      { name: '仰视 45°', heading: 0, pitch: 45 },
      { name: '俯视 -45°', heading: 0, pitch: -45 },
      { name: '东南俯瞰', heading: 135, pitch: -30 },
      { name: '西北仰望', heading: 315, pitch: 30 },
    ];

    const panel = document.getElementById('hotspot-panel');
    for (const hs of hotspots) {
      const btn = document.createElement('button');
      btn.textContent = `🧭 ${hs.name}`;
      btn.addEventListener('click', () => {
        this._sync.flyToDirection(hs.heading, hs.pitch, 1.5);
      });
      panel.appendChild(btn);
    }
  }

  _initDividerDrag() {
    const divider = document.getElementById('divider');
    const container = document.getElementById('main-container');
    const panelLeft = document.getElementById('panel-left');
    const panelRight = document.getElementById('panel-right');

    let isDragging = false;

    divider.addEventListener('pointerdown', (e) => {
      isDragging = true;
      divider.classList.add('dragging');
      divider.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    document.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const rect = container.getBoundingClientRect();
      const isHorizontal = window.innerWidth > 768;

      if (isHorizontal) {
        const ratio = (e.clientX - rect.left) / rect.width;
        const clamped = Math.max(0.2, Math.min(0.8, ratio));
        panelLeft.style.flex = `0 0 ${clamped * 100}%`;
        panelRight.style.flex = `0 0 ${(1 - clamped) * 100}%`;
      }
    });

    const stopDrag = () => {
      if (isDragging) {
        isDragging = false;
        divider.classList.remove('dragging');
        this._pano.resize();
        this._cesium.resize();
      }
    };

    document.addEventListener('pointerup', stopDrag);
    document.addEventListener('pointercancel', stopDrag);
  }

  _initStatusBar() {
    const panoInfoEl = document.getElementById('pano-info');
    const cesiumInfoEl = document.getElementById('cesium-info');
    const modeInfoEl = document.getElementById('mode-info');
    const fpsEl = document.getElementById('fps-info');

    let lastTime = performance.now();
    let frameCount = 0;

    const update = () => {
      const status = this._sync.getStatus();

      panoInfoEl.textContent =
        `全景: heading ${status.panorama.heading.toFixed(1)}° pitch ${status.panorama.pitch.toFixed(1)}° fov ${status.panorama.fov.toFixed(0)}°`;
      cesiumInfoEl.textContent =
        `Cesium: heading ${status.cesium.heading.toFixed(1)}° pitch ${status.cesium.pitch.toFixed(1)}°`;
      modeInfoEl.textContent = status.indoorMode
        ? `模式: 室内 (边界${status.boundsEnabled ? '约束中' : '已禁用'})`
        : '模式: 普通';

      frameCount++;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        fpsEl.textContent = `FPS: ${frameCount}`;
        frameCount = 0;
        lastTime = now;
      }

      requestAnimationFrame(update);
    };

    requestAnimationFrame(update);
  }
}
