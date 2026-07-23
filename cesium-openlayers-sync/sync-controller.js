/**
 * CesiumOpenLayersSyncController - Cesium↔OpenLayers 跨引擎联动控制器
 *
 * 职责：
 * 1. activeSource 追踪（3D/2D）
 * 2. 拾取联动（3D→2D 高亮，2D→3D 高亮）
 * 3. 三维 S3M 选中高亮管理（selectedColor + setSelection）
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

    // 三维高亮状态追踪
    this._highlightedLayer = null;
    this._highlightedSmIds = [];
    this._highlightColor = new Cesium.Color(1.0, 0.9, 0.0, 0.6); // 黄色半透明

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
        color: Cesium.Color.fromCssColorString('#FFE600'),
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

  // ── 三维 S3M 高亮管理 ──

  /**
   * 在指定 S3MTilesLayer 上高亮对象（黄色 selectedColor）
   * 自动清除上一次高亮
   */
  highlightS3MObject(layer, smIds) {
    this.clearS3MHighlight();

    if (!layer || !layer.setSelection || !smIds || smIds.length === 0) return;

    layer.selectedColor = this._highlightColor;
    layer.setSelection(smIds);

    this._highlightedLayer = layer;
    this._highlightedSmIds = smIds.slice();

    console.log('[SyncCtrl] S3M 高亮: layer="' + (layer._name || '?') + '", SmIDs=' + smIds.join(','));
  }

  /**
   * 清除所有三维 S3M 图层上的选中高亮
   * @param {Array} allLayers - 所有 S3M 图层数组，如不传则只清除上次记录的
   */
  clearS3MHighlight(allLayers) {
    if (this._highlightedLayer) {
      try {
        this._highlightedLayer.releaseSelection();
      } catch (_) {}
      this._highlightedLayer = null;
      this._highlightedSmIds = [];
    }

    if (allLayers) {
      for (var i = 0; i < allLayers.length; i++) {
        try {
          if (allLayers[i].releaseSelection) allLayers[i].releaseSelection();
          if (allLayers[i].setSelection) allLayers[i].setSelection([]);
        } catch (_) {}
      }
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
    this.clearS3MHighlight();
    this._map.removeOverlay(this._pickOverlay);
    this._pointerListeners = [];
    this._activeSourceCallbacks = [];
  }
}
