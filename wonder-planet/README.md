# 奇想星球 · Wonder Planet

一颗卡通 / 漫画风格的 Three.js 3D 星球：城市、公路、汽车、飞机、轮船、热气球、火箭、UFO、火山、昼夜循环……可以拖拽旋转、缩放降落到地面、点击载具跟随。

## 直接打开

`index.html` 是打包好的单文件版本，用浏览器直接打开即可（需要联网，从 jsDelivr 加载 three.js）。开启 GitHub Pages 后也可以在线访问。

## 操作

- 拖拽：旋转星球；滚轮 / 双指：缩放（一直放大会降落到地面）
- 双击：飞到指定位置；单击飞机、汽车、轮船等：跟随
- Esc 或「全景」：回到太空视角

## 开发

```bash
npm install
npm run build   # 输出 dist/wonder-planet.html，复制为 index.html 即可
```

源码在 `src/`：`world.js` 地形与世界生成，`shaders.js` 卡通描边 + 网点着色，`cities.js` / `roads.js` / `nature.js` / `features.js` 地表内容，`air.js` / `sea.js` / `space.js` 会动的东西，`camera.js` 相机交互，`ui.js` 界面。
