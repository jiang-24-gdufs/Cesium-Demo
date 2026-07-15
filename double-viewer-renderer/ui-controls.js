/**
 * UIControls - 对等双屏 UI 控件管理
 *
 * 每个 Viewer 拥有独立的场景模式和影像图层控制，
 * 联动开关和状态栏跟随 activeSource 动态切换。
 */
export class UIControls {
  constructor(viewerA, viewerB, syncController, entityManager) {
    this._viewerA = viewerA;
    this._viewerB = viewerB;
    this._sync = syncController;
    this._entities = entityManager;

    this._coordHandler = null;

    this._initToolbar();
    this._initPanelControls();
    this._initFlyToPanel();
    this._initDividerDrag();
    this._initStatusBar();
    this._initActiveSourceHighlight();
  }

  _initToolbar() {
    const cameraSyncBtn = document.getElementById('btn-camera-sync');
    cameraSyncBtn.addEventListener('click', () => {
      const enabled = this._sync.toggleCameraSync();
      cameraSyncBtn.classList.toggle('active', enabled);
      cameraSyncBtn.textContent = enabled ? '相机联动: 开' : '相机联动: 关';
    });

    const clockSyncBtn = document.getElementById('btn-clock-sync');
    clockSyncBtn.addEventListener('click', () => {
      const enabled = this._sync.toggleClockSync();
      clockSyncBtn.classList.toggle('active', enabled);
      clockSyncBtn.textContent = enabled ? '时钟联动: 开' : '时钟联动: 关';
    });

    const loadDemoBtn = document.getElementById('btn-load-demo');
    loadDemoBtn.addEventListener('click', () => {
      this._entities.clearAll();
      this._entities.loadDemoEntities();
    });

    const clearBtn = document.getElementById('btn-clear');
    clearBtn.addEventListener('click', () => {
      this._entities.clearAll();
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

  /**
   * 每个 Viewer 面板内的独立控制：场景模式 + 影像图层
   */
  _initPanelControls() {
    const sceneModeSelects = document.querySelectorAll('.select-scene-mode');
    for (const select of sceneModeSelects) {
      select.addEventListener('change', (e) => {
        const viewerId = e.target.dataset.viewer;
        const mode = parseInt(e.target.value, 10);
        this._sync.switchSceneMode(viewerId, mode);
      });
    }

    const imagerySelects = document.querySelectorAll('.select-imagery');
    for (const select of imagerySelects) {
      select.addEventListener('change', (e) => {
        const viewerId = e.target.dataset.viewer;
        const type = e.target.value;
        this._switchImagery(type, viewerId);
      });
    }
  }

  _switchImagery(type, viewerId) {
    const createProvider = () => {
      switch (type) {
        case 'ion-default':
          return new Cesium.IonImageryProvider({ assetId: 2 });
        case 'osm':
          return new Cesium.OpenStreetMapImageryProvider({
            url: 'https://tile.openstreetmap.org/',
          });
        case 'arcgis':
          return new Cesium.ArcGisMapServerImageryProvider({
            url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',
          });
        default:
          return new Cesium.OpenStreetMapImageryProvider({
            url: 'https://tile.openstreetmap.org/',
          });
      }
    };
    this._sync.switchImagery(createProvider, viewerId);
  }

  _initFlyToPanel() {
    const locations = [
      { name: '北京', lon: 116.3912, lat: 39.9060, height: 2000, heading: 0, pitch: -45 },
      { name: '上海', lon: 121.4737, lat: 31.2304, height: 2000, heading: 0, pitch: -45 },
      { name: '东京', lon: 139.6917, lat: 35.6895, height: 3000, heading: 0, pitch: -45 },
      { name: '纽约', lon: -74.0060, lat: 40.7128, height: 3000, heading: 0, pitch: -45 },
      { name: '伦敦', lon: -0.1276, lat: 51.5074, height: 3000, heading: 0, pitch: -45 },
      { name: '全球视角', lon: 104.0, lat: 35.0, height: 15000000, heading: 0, pitch: -90 },
    ];

    const panel = document.getElementById('flyto-panel');
    for (const loc of locations) {
      const btn = document.createElement('button');
      btn.textContent = loc.name;
      btn.addEventListener('click', () => {
        this._sync.flyTo(
          Cesium.Cartesian3.fromDegrees(loc.lon, loc.lat, loc.height),
          {
            heading: Cesium.Math.toRadians(loc.heading),
            pitch: Cesium.Math.toRadians(loc.pitch),
            roll: 0,
          },
          2
        );
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
        this._viewerA.resize();
        this._viewerB.resize();
      }
    };

    document.addEventListener('pointerup', stopDrag);
    document.addEventListener('pointercancel', stopDrag);
  }

  /**
   * 状态栏：坐标和 FPS 跟随 activeSource 动态切换
   */
  _initStatusBar() {
    const coordEl = document.getElementById('coord-info');
    const fpsEl = document.getElementById('fps-info');
    const activeSourceEl = document.getElementById('active-source-info');

    const setupCoordTracking = (viewer) => {
      if (this._coordHandler) {
        this._coordHandler.destroy();
      }
      this._coordHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      this._coordHandler.setInputAction((movement) => {
        const ray = viewer.camera.getPickRay(movement.endPosition);
        if (!ray) return;
        const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
        if (cartesian) {
          const carto = Cesium.Cartographic.fromCartesian(cartesian);
          const lon = Cesium.Math.toDegrees(carto.longitude).toFixed(5);
          const lat = Cesium.Math.toDegrees(carto.latitude).toFixed(5);
          const alt = carto.height.toFixed(1);
          coordEl.textContent = `经度: ${lon}°  纬度: ${lat}°  高程: ${alt}m`;
        }
      }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    };

    setupCoordTracking(this._viewerA);

    this._sync.onActiveSourceChange((sourceId) => {
      const viewer = sourceId === 'A' ? this._viewerA : this._viewerB;
      setupCoordTracking(viewer);
      activeSourceEl.textContent = `活跃: Viewer ${sourceId}`;
    });

    let lastTime = performance.now();
    let frameCountA = 0;
    let frameCountB = 0;

    this._viewerA.scene.postRender.addEventListener(() => { frameCountA++; });
    this._viewerB.scene.postRender.addEventListener(() => { frameCountB++; });

    setInterval(() => {
      const now = performance.now();
      const elapsed = (now - lastTime) / 1000;
      const source = this._sync.activeSource;
      const fps = source === 'B'
        ? Math.round(frameCountB / elapsed)
        : Math.round(frameCountA / elapsed);
      fpsEl.textContent = `FPS: ${fps}`;
      frameCountA = 0;
      frameCountB = 0;
      lastTime = now;
    }, 1000);
  }

  /**
   * 活跃 Viewer 面板高亮
   */
  _initActiveSourceHighlight() {
    const panelLeft = document.getElementById('panel-left');
    const panelRight = document.getElementById('panel-right');

    this._sync.onActiveSourceChange((sourceId) => {
      panelLeft.classList.toggle('active-source', sourceId === 'A');
      panelRight.classList.toggle('active-source', sourceId === 'B');
    });
  }
}
