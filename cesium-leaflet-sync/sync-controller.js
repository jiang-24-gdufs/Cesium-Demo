/**
 * CesiumLeafletSyncController - Cesium↔Leaflet 跨引擎双向联动控制器
 *
 * Cesium 3D Camera → Leaflet 2D Map: 取相机注视点的经纬度 + 高度映射为 zoom
 * Leaflet 2D Map → Cesium 3D Camera: 取地图中心 + zoom 映射为相机高度，俯视
 *
 * activeSource 追踪当前交互端（3D/2D），仅由 Source 驱动 Target
 */
export class CesiumLeafletSyncController {
  constructor(cesiumViewer, leafletMap) {
    this._viewer = cesiumViewer;
    this._map = leafletMap;

    this._activeSource = null;
    this._syncing = false;
    this._viewSyncEnabled = true;
    this._pickSyncEnabled = true;

    this._preRenderListener = null;
    this._leafletMoveHandler = null;
    this._pointerListeners = [];
    this._activeSourceCallbacks = [];

    this._pickMarker2D = null;
    this._pickEntity3D = null;

    this._init();
  }

  _init() {
    this._setupSourceTracking();
    this._setupViewSync();
  }

  _setupSourceTracking() {
    const cesiumEl = this._viewer.container;
    const leafletEl = this._map.getContainer();

    const bind = (el, id) => {
      const handler = () => {
        if (this._activeSource !== id) {
          this._activeSource = id;
          for (const cb of this._activeSourceCallbacks) cb(id);
        }
      };
      el.addEventListener('pointerdown', handler);
      el.addEventListener('wheel', handler, { passive: true });
      this._pointerListeners.push({ el, type: 'pointerdown', handler });
      this._pointerListeners.push({ el, type: 'wheel', handler });
    };

    bind(cesiumEl, '3D');
    bind(leafletEl, '2D');
  }

  /**
   * Cesium → Leaflet: 从相机注视点投影到地表取经纬度
   * Leaflet → Cesium: 从地图中心和 zoom 反算相机位置（俯视）
   */
  _setupViewSync() {
    this._preRenderListener = () => {
      if (!this._viewSyncEnabled || this._syncing || this._activeSource !== '3D') return;
      this._syncCesiumToLeaflet();
    };
    this._viewer.scene.preRender.addEventListener(this._preRenderListener);

    this._leafletMoveHandler = () => {
      if (!this._viewSyncEnabled || this._syncing || this._activeSource !== '2D') return;
      this._syncLeafletToCesium();
    };
    this._map.on('move', this._leafletMoveHandler);
  }

  _syncCesiumToLeaflet() {
    this._syncing = true;
    try {
      const cam = this._viewer.camera;
      const carto = this._getCameraGroundPoint(cam);
      if (!carto) return;

      const lng = Cesium.Math.toDegrees(carto.longitude);
      const lat = Cesium.Math.toDegrees(carto.latitude);
      const height = cam.positionCartographic.height;
      const zoom = this._heightToZoom(height);

      this._map.setView([lat, lng], zoom, { animate: false });
    } finally {
      this._syncing = false;
    }
  }

  _syncLeafletToCesium() {
    this._syncing = true;
    try {
      const center = this._map.getCenter();
      const zoom = this._map.getZoom();
      const height = this._zoomToHeight(zoom);

      this._viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(center.lng, center.lat, height),
        orientation: {
          heading: 0,
          pitch: Cesium.Math.toRadians(-90),
          roll: 0,
        },
      });
    } finally {
      this._syncing = false;
    }
  }

  /**
   * 取相机注视点：射线求交地球表面
   */
  _getCameraGroundPoint(cam) {
    const scene = this._viewer.scene;
    const canvas = scene.canvas;
    const center = new Cesium.Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2);

    const ray = cam.getPickRay(center);
    if (!ray) return cam.positionCartographic;

    const intersection = scene.globe.pick(ray, scene);
    if (intersection) {
      return Cesium.Cartographic.fromCartesian(intersection);
    }
    return cam.positionCartographic;
  }

  /**
   * Cesium 相机高度 ↔ Leaflet zoom 级别 的近似映射
   * 经验公式: zoom ≈ log2(C / height), C 基于 Leaflet 标准瓦片参数
   */
  _heightToZoom(height) {
    const C = 40075016.686;
    const zoom = Math.log2(C / Math.max(height, 1)) - 1;
    return Math.max(1, Math.min(22, zoom));
  }

  _zoomToHeight(zoom) {
    const C = 40075016.686;
    return C / Math.pow(2, zoom + 1);
  }

  /** 在二维地图上放置拾取标记 */
  showPickMarker2D(lng, lat, popupHtml) {
    this.clearPickMarker2D();
    this._pickMarker2D = L.marker([lat, lng], {
      icon: L.divIcon({
        className: 'pick-marker-2d',
        html: '<div class="pick-dot"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      }),
    }).addTo(this._map);

    if (popupHtml) {
      this._pickMarker2D.bindPopup(popupHtml, { maxWidth: 300 }).openPopup();
    }
  }

  clearPickMarker2D() {
    if (this._pickMarker2D) {
      this._map.removeLayer(this._pickMarker2D);
      this._pickMarker2D = null;
    }
  }

  /** 在三维场景中放置拾取高亮实体 */
  showPickEntity3D(lng, lat, height, name) {
    this.clearPickEntity3D();
    this._pickEntity3D = this._viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(lng, lat, height || 0),
      point: {
        pixelSize: 14,
        color: Cesium.Color.fromCssColorString('#ff4757'),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        heightReference: Cesium.HeightReference.NONE,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: name || '',
        font: '13px sans-serif',
        fillColor: Cesium.Color.WHITE,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 2,
        outlineColor: Cesium.Color.BLACK,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -18),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
  }

  clearPickEntity3D() {
    if (this._pickEntity3D) {
      this._viewer.entities.remove(this._pickEntity3D);
      this._pickEntity3D = null;
    }
  }

  clearAllPick() {
    this.clearPickMarker2D();
    this.clearPickEntity3D();
  }

  onActiveSourceChange(callback) {
    this._activeSourceCallbacks.push(callback);
  }

  toggleViewSync(enabled) {
    this._viewSyncEnabled = typeof enabled === 'boolean' ? enabled : !this._viewSyncEnabled;
    return this._viewSyncEnabled;
  }

  togglePickSync(enabled) {
    this._pickSyncEnabled = typeof enabled === 'boolean' ? enabled : !this._pickSyncEnabled;
    return this._pickSyncEnabled;
  }

  get viewSyncEnabled() { return this._viewSyncEnabled; }
  get pickSyncEnabled() { return this._pickSyncEnabled; }
  get activeSource() { return this._activeSource; }

  /** 二三维同步飞行 */
  flyTo(lng, lat, height, duration = 1.5) {
    const zoom = this._heightToZoom(height);
    this._viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lng, lat, height),
      orientation: { heading: 0, pitch: Cesium.Math.toRadians(-45), roll: 0 },
      duration,
    });
    this._map.flyTo([lat, lng], zoom, { duration: duration });
  }

  destroy() {
    if (this._preRenderListener) {
      this._viewer.scene.preRender.removeEventListener(this._preRenderListener);
    }
    if (this._leafletMoveHandler) {
      this._map.off('move', this._leafletMoveHandler);
    }
    for (const { el, type, handler } of this._pointerListeners) {
      el.removeEventListener(type, handler);
    }
    this.clearAllPick();
    this._pointerListeners = [];
    this._activeSourceCallbacks = [];
  }
}
