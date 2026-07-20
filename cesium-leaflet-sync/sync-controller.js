/**
 * CesiumLeafletSyncController - Cesium↔Leaflet 跨引擎联动控制器
 *
 * 职责：
 * 1. activeSource 追踪（3D/2D）
 * 2. 拾取联动（3D→2D 标记，2D→3D 实体）
 *
 * 注意：视角联动已移除（二维/三维场景坐标系差异过大不适合自动同步）
 */
export class CesiumLeafletSyncController {
  constructor(cesiumViewer, leafletMap) {
    this._viewer = cesiumViewer;
    this._map = leafletMap;

    this._activeSource = null;
    this._pickSyncEnabled = true;

    this._pointerListeners = [];
    this._activeSourceCallbacks = [];

    this._pickMarker2D = null;
    this._pickEntity3D = null;

    this._setupSourceTracking();
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

  togglePickSync(enabled) {
    this._pickSyncEnabled = typeof enabled === 'boolean' ? enabled : !this._pickSyncEnabled;
    return this._pickSyncEnabled;
  }

  get pickSyncEnabled() { return this._pickSyncEnabled; }
  get activeSource() { return this._activeSource; }

  destroy() {
    for (const { el, type, handler } of this._pointerListeners) {
      el.removeEventListener(type, handler);
    }
    this.clearAllPick();
    this._pointerListeners = [];
    this._activeSourceCallbacks = [];
  }
}
