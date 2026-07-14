/**
 * SyncController - 双 Viewer 联动控制器
 * 管理相机、时钟、图层的双向同步，并提供防循环机制。
 */
export class SyncController {
  constructor(viewerA, viewerB) {
    this._viewerA = viewerA;
    this._viewerB = viewerB;
    this._syncing = false;
    this._cameraSyncEnabled = true;
    this._clockSyncEnabled = true;
    this._activeViewer = null;

    this._preRenderListenerA = null;
    this._preRenderListenerB = null;
    this._pointerListeners = [];

    this._init();
  }

  _init() {
    this._setupPointerTracking();
    this._setupCameraSync();
    this._setupClockSync();
  }

  /**
   * 追踪用户当前操作的 Viewer，决定同步方向
   */
  _setupPointerTracking() {
    const containers = [
      { el: this._viewerA.container, viewer: 'A' },
      { el: this._viewerB.container, viewer: 'B' },
    ];
    for (const { el, viewer } of containers) {
      const handler = () => { this._activeViewer = viewer; };
      el.addEventListener('pointerdown', handler);
      el.addEventListener('wheel', handler, { passive: true });
      this._pointerListeners.push({ el, type: 'pointerdown', handler });
      this._pointerListeners.push({ el, type: 'wheel', handler });
    }
  }

  /**
   * 双向相机同步
   * 仅从"活跃 Viewer"同步到"非活跃 Viewer"，通过 _syncing 标志位阻断循环。
   */
  _setupCameraSync() {
    this._preRenderListenerA = () => {
      if (!this._cameraSyncEnabled || this._syncing || this._activeViewer !== 'A') return;
      this._syncCameraFromTo(this._viewerA, this._viewerB);
    };

    this._preRenderListenerB = () => {
      if (!this._cameraSyncEnabled || this._syncing || this._activeViewer !== 'B') return;
      this._syncCameraFromTo(this._viewerB, this._viewerA);
    };

    this._viewerA.scene.preRender.addEventListener(this._preRenderListenerA);
    this._viewerB.scene.preRender.addEventListener(this._preRenderListenerB);
  }

  _syncCameraFromTo(source, target) {
    if (target.scene.mode === Cesium.SceneMode.MORPHING) return;
    this._syncing = true;
    try {
      const srcCam = source.camera;
      target.camera.setView({
        destination: srcCam.positionWC.clone(),
        orientation: {
          heading: srcCam.heading,
          pitch: srcCam.pitch,
          roll: srcCam.roll,
        },
      });
    } finally {
      this._syncing = false;
    }
  }

  /**
   * 时钟联动：B 始终跟随 A 的时钟状态
   */
  _setupClockSync() {
    this._viewerA.clock.onTick.addEventListener((clock) => {
      if (!this._clockSyncEnabled) return;
      const bClock = this._viewerB.clock;
      if (!Cesium.JulianDate.equals(bClock.currentTime, clock.currentTime)) {
        bClock.currentTime = Cesium.JulianDate.clone(clock.currentTime);
      }
      bClock.multiplier = clock.multiplier;
      bClock.shouldAnimate = clock.shouldAnimate;
    });
  }

  /** 切换相机联动 */
  toggleCameraSync(enabled) {
    this._cameraSyncEnabled = typeof enabled === 'boolean' ? enabled : !this._cameraSyncEnabled;
    return this._cameraSyncEnabled;
  }

  /** 切换时钟联动 */
  toggleClockSync(enabled) {
    this._clockSyncEnabled = typeof enabled === 'boolean' ? enabled : !this._clockSyncEnabled;
    return this._clockSyncEnabled;
  }

  get cameraSyncEnabled() { return this._cameraSyncEnabled; }
  get clockSyncEnabled() { return this._clockSyncEnabled; }

  /**
   * 双屏同步飞行
   */
  flyTo(destination, orientation, duration = 2) {
    const opts = {
      destination: destination.clone(),
      orientation: { ...orientation },
      duration,
    };
    this._viewerA.camera.flyTo({ ...opts, destination: destination.clone() });
    this._viewerB.camera.flyTo({ ...opts, destination: destination.clone() });
  }

  /**
   * 同步切换影像图层
   */
  switchImageryForBoth(providerFactory) {
    this._replaceBaseImagery(this._viewerA, providerFactory);
    this._replaceBaseImagery(this._viewerB, providerFactory);
  }

  _replaceBaseImagery(viewer, providerFactory) {
    const layers = viewer.imageryLayers;
    if (layers.length > 0) {
      layers.remove(layers.get(0));
    }
    layers.addImageryProvider(providerFactory(), 0);
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
  }
}
