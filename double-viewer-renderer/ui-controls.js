/**
 * UIControls - UI 控件管理
 * 管理工具栏按钮、场景模式切换、影像图层切换、飞行定位面板。
 */
export class UIControls {
  constructor(viewerA, viewerB, syncController, entityManager) {
    this._viewerA = viewerA;
    this._viewerB = viewerB;
    this._sync = syncController;
    this._entities = entityManager;

    this._initToolbar();
    this._initFlyToPanel();
    this._initDividerDrag();
    this._initStatusBar();
  }

  _initToolbar() {
    // 相机联动开关
    const cameraSyncBtn = document.getElementById('btn-camera-sync');
    cameraSyncBtn.classList.add('active');
    cameraSyncBtn.addEventListener('click', () => {
      const enabled = this._sync.toggleCameraSync();
      cameraSyncBtn.classList.toggle('active', enabled);
      cameraSyncBtn.textContent = enabled ? '相机联动: 开' : '相机联动: 关';
    });

    // 场景模式切换（右屏）
    const sceneModeSelect = document.getElementById('select-scene-mode');
    sceneModeSelect.addEventListener('change', (e) => {
      const mode = parseInt(e.target.value, 10);
      this._viewerB.scene.morphTo2D(0);
      switch (mode) {
        case Cesium.SceneMode.SCENE3D:
          this._viewerB.scene.morphTo3D(1);
          break;
        case Cesium.SceneMode.SCENE2D:
          this._viewerB.scene.morphTo2D(1);
          break;
        case Cesium.SceneMode.COLUMBUS_VIEW:
          this._viewerB.scene.morphToColumbusView(1);
          break;
      }
    });

    // 影像图层切换
    const imagerySelect = document.getElementById('select-imagery');
    imagerySelect.addEventListener('change', (e) => {
      const type = e.target.value;
      this._switchImagery(type);
    });

    // 加载示例数据按钮
    const loadDemoBtn = document.getElementById('btn-load-demo');
    loadDemoBtn.addEventListener('click', () => {
      this._entities.clearAll();
      this._entities.loadDemoEntities();
    });

    // 清除实体按钮
    const clearBtn = document.getElementById('btn-clear');
    clearBtn.addEventListener('click', () => {
      this._entities.clearAll();
    });

    // Token 设置
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
        case 'stamen-terrain':
          return new Cesium.OpenStreetMapImageryProvider({
            url: 'https://tiles.stadiamaps.com/tiles/stamen_terrain/',
          });
        default:
          return new Cesium.OpenStreetMapImageryProvider({
            url: 'https://tile.openstreetmap.org/',
          });
      }
    };
    this._sync.switchImageryForBoth(createProvider);
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
      btn.textContent = `📍 ${loc.name}`;
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

  _initStatusBar() {
    const coordEl = document.getElementById('coord-info');
    const fpsEl = document.getElementById('fps-info');

    const handler = new Cesium.ScreenSpaceEventHandler(this._viewerA.scene.canvas);
    handler.setInputAction((movement) => {
      const ray = this._viewerA.camera.getPickRay(movement.endPosition);
      if (!ray) return;
      const cartesian = this._viewerA.scene.globe.pick(ray, this._viewerA.scene);
      if (cartesian) {
        const carto = Cesium.Cartographic.fromCartesian(cartesian);
        const lon = Cesium.Math.toDegrees(carto.longitude).toFixed(5);
        const lat = Cesium.Math.toDegrees(carto.latitude).toFixed(5);
        const alt = carto.height.toFixed(1);
        coordEl.textContent = `经度: ${lon}°  纬度: ${lat}°  高程: ${alt}m`;
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    let lastTime = performance.now();
    let frameCount = 0;
    this._viewerA.scene.postRender.addEventListener(() => {
      frameCount++;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        fpsEl.textContent = `FPS: ${frameCount}`;
        frameCount = 0;
        lastTime = now;
      }
    });
  }
}
