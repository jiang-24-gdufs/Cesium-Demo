/**
 * DualSyncController - 超图双 Viewer 对等联动控制器
 *
 * 基于 activeSource 动态决定同步方向，支持相机联动开关。
 * 专为 SuperMap iClient3D for Cesium 定制。
 */
export class DualSyncController {
  constructor(viewerA, viewerB) {
    this._viewerA = viewerA;
    this._viewerB = viewerB;
    this._activeSource = null;
    this._cameraSyncing = false;
    this._cameraSyncEnabled = true;
    this._preRenderListenerA = null;
    this._preRenderListenerB = null;
    this._pointerListeners = [];
    this._activeSourceCallbacks = [];

    this._setupSourceTracking();
    this._setupCameraSync();
  }

  _setupSourceTracking() {
    const viewers = [
      { el: this._viewerA.container, id: 'A' },
      { el: this._viewerB.container, id: 'B' },
    ];

    for (const { el, id } of viewers) {
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
    }
  }

  _setupCameraSync() {
    this._preRenderListenerA = () => {
      if (!this._cameraSyncEnabled || this._cameraSyncing || this._activeSource !== 'A') return;
      this._syncCamera(this._viewerA, this._viewerB);
    };

    this._preRenderListenerB = () => {
      if (!this._cameraSyncEnabled || this._cameraSyncing || this._activeSource !== 'B') return;
      this._syncCamera(this._viewerB, this._viewerA);
    };

    this._viewerA.scene.preRender.addEventListener(this._preRenderListenerA);
    this._viewerB.scene.preRender.addEventListener(this._preRenderListenerB);
  }

  _syncCamera(source, target) {
    if (target.scene.mode === Cesium.SceneMode.MORPHING) return;
    this._cameraSyncing = true;
    try {
      const cam = source.camera;
      target.camera.setView({
        destination: cam.positionWC.clone(),
        orientation: {
          heading: cam.heading,
          pitch: cam.pitch,
          roll: cam.roll,
        },
      });
    } finally {
      this._cameraSyncing = false;
    }
  }

  onActiveSourceChange(callback) {
    this._activeSourceCallbacks.push(callback);
  }

  toggleCameraSync(enabled) {
    this._cameraSyncEnabled = typeof enabled === 'boolean' ? enabled : !this._cameraSyncEnabled;
    return this._cameraSyncEnabled;
  }

  get cameraSyncEnabled() { return this._cameraSyncEnabled; }
  get activeSource() { return this._activeSource; }

  getViewer(id) {
    return id === 'A' ? this._viewerA : this._viewerB;
  }

  getOtherViewer(id) {
    return id === 'A' ? this._viewerB : this._viewerA;
  }

  flyBoth(destination, orientation, duration = 1.5) {
    const opts = { orientation: { ...orientation }, duration };
    this._viewerA.camera.flyTo({ ...opts, destination: destination.clone() });
    this._viewerB.camera.flyTo({ ...opts, destination: destination.clone() });
  }

  destroy() {
    if (this._preRenderListenerA) {
      this._viewerA.scene.preRender.removeEventListener(this._preRenderListenerA);
    }
    if (this._preRenderListenerB) {
      this._viewerB.scene.preRender.removeEventListener(this._preRenderListenerB);
    }
    for (const { el, type, handler } of this._pointerListeners) {
      el.removeEventListener(type, handler);
    }
    this._pointerListeners = [];
    this._activeSourceCallbacks = [];
  }
}
