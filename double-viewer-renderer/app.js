import { PeerSyncController } from './sync-controller.js';
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

// ── 创建对等双 Viewer ──
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

viewerA.imageryLayers.addImageryProvider(baseImageryProvider);
viewerB.imageryLayers.addImageryProvider(
  new Cesium.OpenStreetMapImageryProvider({ url: 'https://tile.openstreetmap.org/' })
);

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

// ── 初始化对等联动控制器 ──
const syncController = new PeerSyncController(viewerA, viewerB);

// ── 初始化实体管理器 ──
const entityManager = new EntityManager(viewerA, viewerB);

// ── 初始化 UI 控件 ──
const uiControls = new UIControls(viewerA, viewerB, syncController, entityManager);

// ── 设置初始视角 ──
const initialView = {
  destination: Cesium.Cartesian3.fromDegrees(104.0, 35.0, 8000000),
  orientation: {
    heading: 0,
    pitch: Cesium.Math.toRadians(-90),
    roll: 0,
  },
};

viewerA.camera.setView(initialView);
viewerB.camera.setView({
  destination: initialView.destination.clone(),
  orientation: { ...initialView.orientation },
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

console.log('[DoubleViewerRenderer] 双屏对等联动应用已启动');
