/**
 * CesiumOpenLayersSyncController - Cesium↔OpenLayers 跨引擎联动控制器
 *
 * 职责：
 * 1. activeSource 追踪（3D/2D）
 * 2. 拾取联动（3D→2D 高亮，2D→3D 高亮）
 */
class CesiumOpenLayersSyncController {
  constructor(cesiumViewer, olMap) {
    this._viewer = cesiumViewer;
    this._map = olMap;

    this._activeSource = null;
    this._pickSyncEnabled = true;

    this._pointerListeners = [];
    this._activeSourceCallbacks = [];

    this._pickOverlay = null;
    this._pickEntity3D = null;

    this._setupSourceTracking();
    this._setupPickOverlay();
  }

  _setupSourceTracking() {
    const cesiumEl = this._viewer.container;
    const olEl = this._map.getTargetElement();

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
    bind(olEl, '2D');
  }

  _setupPickOverlay() {
    const el = document.createElement('div');
    el.className = 'ol-pick-overlay';
    el.style.display = 'none';
    this._pickOverlayEl = el;

    this._pickOverlay = new ol.Overlay({
      element: el,
      positioning: 'center-center',
      stopEvent: false,
    });
    this._map.addOverlay(this._pickOverlay);
  }

  showPickMarker2D(coordinate) {
    this._pickOverlayEl.style.display = 'block';
    this._pickOverlay.setPosition(coordinate);
  }

  clearPickMarker2D() {
    this._pickOverlayEl.style.display = 'none';
    this._pickOverlay.setPosition(undefined);
  }

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
    this._map.removeOverlay(this._pickOverlay);
    this._pointerListeners = [];
    this._activeSourceCallbacks = [];
  }
}
