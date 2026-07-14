import { SyncController } from './sync-controller.js';
import { EntityManager } from './entities.js';
import { UIControls } from './ui-controls.js';

/**
 * 应用初始化入口
 *
 * Token 优先级：URL 参数 > localStorage > 内置评估 Token
 * 使用方式：http://localhost:8080?token=YOUR_CESIUM_ION_TOKEN
 * 或在页面中通过 Token 输入框设置
 */
const urlParams = new URLSearchParams(window.location.search);
const savedToken = urlParams.get('token')
  || localStorage.getItem('cesium_ion_token')
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlYWE1OWUxNy1mMWZiLTQzYjYtYTQ0OS1kMWFjYmFkNjc5YzciLCJpZCI6NTc3MzMsImlhdCI6MTYyNzg0NTE4Mn0.XcKpgANiY19MC4bdFUXMVEBToBmqS8kuYpUlxJHYZxk';

Cesium.Ion.defaultAccessToken = savedToken;

/**
 * 使用不依赖 Ion Token 的 OpenStreetMap 作为默认底图
 * 确保在没有有效 Token 的情况下也能正确显示地球影像
 */
const baseImageryProvider = new Cesium.OpenStreetMapImageryProvider({
  url: 'https://tile.openstreetmap.org/',
});

const viewerOptions = {
  animation: false,
  baseLayerPicker: false,
  fullscreenButton: false,
  vrButton: false,
  geocoder: false,
  homeButton: true,
  infoBox: true,
  sceneModePicker: false,
  selectionIndicator: true,
  timeline: false,
  navigationHelpButton: false,
  scene3DOnly: false,
  creditContainer: document.createElement('div'),
};

// ── 创建双 Viewer ──
const viewerA = new Cesium.Viewer('viewer-a', {
  ...viewerOptions,
  baseLayer: Cesium.ImageryLayer.fromProviderAsync(
    Cesium.TileMapServiceImageryProvider.fromUrl(
      Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII')
    )
  ),
});

const viewerB = new Cesium.Viewer('viewer-b', {
  ...viewerOptions,
  baseLayer: Cesium.ImageryLayer.fromProviderAsync(
    Cesium.TileMapServiceImageryProvider.fromUrl(
      Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII')
    )
  ),
});

// 在默认底图之上叠加 OSM 瓦片，提供更高清的地图
viewerA.imageryLayers.addImageryProvider(baseImageryProvider);
viewerB.imageryLayers.addImageryProvider(
  new Cesium.OpenStreetMapImageryProvider({ url: 'https://tile.openstreetmap.org/' })
);

// 尝试加载 Ion 地形（如果 Token 有效）
async function tryLoadTerrain(viewer) {
  try {
    const terrain = await Cesium.CesiumTerrainProvider.fromIonAssetId(1);
    viewer.terrainProvider = terrain;
  } catch (e) {
    console.warn('Ion 地形加载失败，使用默认平坦地形:', e.message);
  }
}

tryLoadTerrain(viewerA);
tryLoadTerrain(viewerB);

// ── 加载 OSM 建筑 3D Tiles ──
async function loadOSMBuildings() {
  try {
    const tilesetA = await Cesium.createOsmBuildingsAsync();
    const tilesetB = await Cesium.createOsmBuildingsAsync();
    viewerA.scene.primitives.add(tilesetA);
    viewerB.scene.primitives.add(tilesetB);
  } catch (e) {
    console.warn('OSM Buildings 加载失败（可能 Token 无权限），跳过:', e.message);
  }
}

loadOSMBuildings();

// ── 初始化联动控制器 ──
const syncController = new SyncController(viewerA, viewerB);

// ── 初始化实体管理器 ──
const entityManager = new EntityManager(viewerA, viewerB);

// ── 初始化 UI 控件 ──
const uiControls = new UIControls(viewerA, viewerB, syncController, entityManager);

// ── 设置初始视角（中国） ──
viewerA.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(104.0, 35.0, 8000000),
  orientation: {
    heading: 0,
    pitch: Cesium.Math.toRadians(-90),
    roll: 0,
  },
});

viewerB.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(104.0, 35.0, 8000000),
  orientation: {
    heading: 0,
    pitch: Cesium.Math.toRadians(-90),
    roll: 0,
  },
});

// ── 默认加载示例数据 ──
entityManager.loadDemoEntities();

// ── Token 设置功能（暴露到全局） ──
window.setCesiumToken = (token) => {
  if (!token) return;
  localStorage.setItem('cesium_ion_token', token);
  Cesium.Ion.defaultAccessToken = token;
  window.location.reload();
};

console.log('[DoubleViewerRenderer] 双屏渲染应用已启动');
