# 战舰世界 七号插
# WWS No. 7 insert

![No. 7 insert 图标](source/src/assets/app-icon.png)

**No. 7 insert** 是面向《战舰世界》WG 服的开源战绩查询与对局助手。当前版本为 **V0.1.3**，首次公开版本为 **V0.1.1**。

## 下载完整程序

Windows 安装版和便携版放在 [V0.1.3 发布页](https://github.com/awhite1127/wws-no-7-insert/releases/tag/V0.1.3)。安装版支持选择安装目录并创建快捷方式；便携版可直接运行。两者包含相同功能与图标。

源码在本仓库的 [source](source) 文件夹；打包文件通过 GitHub Releases 分发，避免把大型二进制文件写入 Git 历史。

## V0.1.3 更新

- 七号插对局页按航母、战列舰、巡洋舰、驱逐舰、潜艇排序，双方 12 人逐行对照；收紧布局并扩大默认窗口，让完整 12v12 战绩更容易同时查看。
- 账号胜率文字及玩家名称左侧标记按七档胜率着色；对局船名和模拟对局船名采用 WG 国际服官方简体中文。
- 首页按键卡面可直接设置呼出键，设置中可关闭按键呼出；移除“按住预览”。
- 箱子查询改用 WG 国际服简中目录和奖励名称，补全经济加成、收藏品拼图及金币战舰的名称与等级展示，并移除重复的介绍卡片。

## 功能

- 支持亚服、欧服、美服玩家战绩和军团查询
- 展示总体战绩、单舰战绩、排位赛季数据和本地查询历史
- 自动识别并监控游戏的 `replays/tempArenaInfo.json`
- 七号插按舰种排序双方阵容，展示账号与单舰数据、胜率走势图及读取日志
- 七号插首页显示游戏路径与对局文件识别状态，仅在文件内容更新后载入新对局
- 数据检索提供箱子查询，搜索补给箱并查看官网公布的奖励与概率
- 支持 12v12 模拟对局、刷新数据和游戏内透明覆盖层
- 支持 WG 账号授权、个人战绩、港口舰船活动奖励汇总
- 支持黑色与白色主题、自定义或关闭覆盖层呼出按键

程序只读取本地对局文件及 WG 官方接口，不修改游戏文件。

## 从源码运行

需要 Node.js 与 npm。在 [source/.env.example](source/.env.example) 的基础上创建 `source/.env.local`，填入自己的 WG `application_id`，再执行：

```powershell
cd source
npm ci
npm run dev
```

`source/.env.local` 已排除在 Git 之外。程序不会在设置页显示该值。

## 测试与构建

```powershell
cd source
npm test
npm run build
npm run dist
```

`npm run dist` 会在根目录的 `release` 文件夹生成安装版、便携版和解压版。图标源文件为 [app-icon.png](source/src/assets/app-icon.png)，Windows 图标由 [generate-icon.ps1](source/build/generate-icon.ps1) 生成。

## 许可证

[MIT](LICENSE)
