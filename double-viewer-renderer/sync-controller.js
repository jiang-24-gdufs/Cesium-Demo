/**
 * PeerSyncController - 对等双向联动控制器
 *
 * 核心设计：两个 Viewer 完全对等，同步方向由 activeSource 动态决定。
 * 用户正在交互的 Viewer 为 Source，对端为 Target。
 */
export class PeerSyncController {
  constructor(viewerA, viewerB) {
    this._viewerA = viewerA;
    this._viewerB = viewerB;

    this._activeSource = null;
    this._cameraSyncing = false;
    this._clockSyncing = false;

    this._cameraSyncEnabled = true;
    this._clockSyncEnabled = true;

    this._preRenderListenerA = null;
    this._preRenderListenerB = null;
    this._clockListenerA = null;
    this._clockListenerB = null;
    this._pointerListeners = [];
    this._activeSourceCallbacks = [];

    this._init();
  }

  _init() {
    this._setupSourceTracking();
    this._setupCameraSync();
    this._setupClockSync();
  }

  /**
   * 追踪用户当前操作的 Viewer，确定同步 Source。
   * 监听 pointerdown 和 wheel 事件，谁触发谁成为 Source。
   */
  _setupSourceTracking() {
    const viewers = [
      { el: this._viewerA.container, id: 'A' },
      { el: this._viewerB.container, id: 'B' },
    ];

    for (const { el, id } of viewers) {
      const handler = () => {
        if (this._activeSource !== id) {
          this._activeSource = id;
          this._notifyActiveSourceChange(id);
        }
      };
      el.addEventListener('pointerdown', handler);
      el.addEventListener('wheel', handler, { passive: true });
      this._pointerListeners.push({ el, type: 'pointerdown', handler });
      this._pointerListeners.push({ el, type: 'wheel', handler });
    }
  }

  /**
   * 双向相机同步。
   * 仅当该端为 activeSource 时才触发 Source → Target 同步，
   * _cameraSyncing 标志位阻断 setView 触发的反向 preRender。
   */
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

  /**
   * 双向时钟同步。
   * 两端都注册 onTick，仅 activeSource 一侧的 tick 才触发同步。
   */
  _setupClockSync() {
    this._clockListenerA = (clock) => {
      if (this._activeSource === 'A') {
        this._syncClock(clock, this._viewerB.clock);
      }
    };

    this._clockListenerB = (clock) => {
      if (this._activeSource === 'B') {
        this._syncClock(clock, this._viewerA.clock);
      }
    };

    this._viewerA.clock.onTick.addEventListener(this._clockListenerA);
    this._viewerB.clock.onTick.addEventListener(this._clockListenerB);
  }

  _syncClock(sourceClock, targetClock) {
    if (!this._clockSyncEnabled || this._clockSyncing) return;
    this._clockSyncing = true;
    try {
      if (!Cesium.JulianDate.equals(targetClock.currentTime, sourceClock.currentTime)) {
        targetClock.currentTime = Cesium.JulianDate.clone(sourceClock.currentTime);
      }
      targetClock.multiplier = sourceClock.multiplier;
      targetClock.shouldAnimate = sourceClock.shouldAnimate;
    } finally {
      this._clockSyncing = false;
    }
  }

  /** 注册 activeSource 变化回调 */
  onActiveSourceChange(callback) {
    this._activeSourceCallbacks.push(callback);
  }

  _notifyActiveSourceChange(sourceId) {
    for (const cb of this._activeSourceCallbacks) {
      cb(sourceId);
    }
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
  get activeSource() { return this._activeSource; }

  /**
   * 获取当前 Source/Target Viewer 对
   * @returns {{ source: Viewer, target: Viewer } | null}
   */
  getSourceTarget() {
    if (this._activeSource === 'A') {
      return { source: this._viewerA, target: this._viewerB };
    }
    if (this._activeSource === 'B') {
      return { source: this._viewerB, target: this._viewerA };
    }
    return null;
  }

  /**
   * 双屏同步飞行
   */
  flyTo(destination, orientation, duration = 2) {
    const opts = { orientation: { ...orientation }, duration };
    this._viewerA.camera.flyTo({ ...opts, destination: destination.clone() });
    this._viewerB.camera.flyTo({ ...opts, destination: destination.clone() });
  }

  /**
   * 同步切换影像图层（可选联动或仅作用于指定 Viewer）
   * @param {Function} providerFactory - 返回 ImageryProvider 的工厂函数
   * @param {'A'|'B'|'both'} target - 作用目标
   */
  switchImagery(providerFactory, target = 'both') {
    if (target === 'A' || target === 'both') {
      this._replaceBaseImagery(this._viewerA, providerFactory);
    }
    if (target === 'B' || target === 'both') {
      this._replaceBaseImagery(this._viewerB, providerFactory);
    }
  }

  _replaceBaseImagery(viewer, providerFactory) {
    const layers = viewer.imageryLayers;
    if (layers.length > 0) {
      layers.remove(layers.get(0));
    }
    layers.addImageryProvider(providerFactory(), 0);
  }

  /**
   * 切换指定 Viewer 的场景模式
   * @param {'A'|'B'} viewerId
   * @param {number} mode - Cesium.SceneMode 值
   */
  switchSceneMode(viewerId, mode) {
    const viewer = viewerId === 'A' ? this._viewerA : this._viewerB;
    switch (mode) {
      case Cesium.SceneMode.SCENE3D:
        viewer.scene.morphTo3D(1);
        break;
      case Cesium.SceneMode.SCENE2D:
        viewer.scene.morphTo2D(1);
        break;
      case Cesium.SceneMode.COLUMBUS_VIEW:
        viewer.scene.morphToColumbusView(1);
        break;
    }
  }

  destroy() {
    if (this._preRenderListenerA) {
      this._viewerA.scene.preRender.removeEventListener(this._preRenderListenerA);
    }
    if (this._preRenderListenerB) {
      this._viewerB.scene.preRender.removeEventListener(this._preRenderListenerB);
    }
    if (this._clockListenerA) {
      this._viewerA.clock.onTick.removeEventListener(this._clockListenerA);
    }
    if (this._clockListenerB) {
      this._viewerB.clock.onTick.removeEventListener(this._clockListenerB);
    }
    for (const { el, type, handler } of this._pointerListeners) {
      el.removeEventListener(type, handler);
    }
    this._pointerListeners = [];
    this._activeSourceCallbacks = [];
  }
}
