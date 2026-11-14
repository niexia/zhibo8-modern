# Chrome Web Store 上架资料

当前版本：**v1.1.1**（首页专属 + 默认精简导航）

## 上传顺序

1. **Store listing → Description**：粘贴 `store/description.txt`。
2. **Graphic assets → Store icon**：`store/assets/store-icon-128.png`（128×128）。
3. **Graphic assets → Screenshots**：按此顺序上传 5 张：
   - `store/assets/screenshots/01-home-light.png`
   - `store/assets/screenshots/02-home-dark.png`
   - `store/assets/screenshots/03-simplified-nav.png`
   - `store/assets/screenshots/04-popup-themes.png`
   - `store/assets/screenshots/05-reversible.png`
4. **Small promo tile**：`store/assets/small-promo-440x280.png`（440×280）。
5. **Marquee promo tile**（可选）：`store/assets/marquee-1400x560.png`（1400×560）。
6. **Homepage URL** 填 `https://github.com/niexia/zhibo8-modern`；**Support URL** 填 `https://github.com/niexia/zhibo8-modern/issues`；Official URL 留空。
7. 打开 **Privacy** 标签，按 `store/privacy-practices.md` 填写；隐私政策 URL 使用 `https://github.com/niexia/zhibo8-modern/blob/main/PRIVACY.md`。
8. 打开 **Test instructions**，粘贴 `store/test-instructions.txt`。
9. **Distribution**：Free、Public、All regions；Mature content 关闭。
10. 完成后检查 “Why can't I submit?”，通常剩余项是隐私问卷、分发设置或素材未填。

## Before submitting

- `PRIVACY.md` now lists the current four preferences (including simplified navigation). The public privacy-policy URL points at the `main` branch copy, so keep this file and `store/privacy-policy.md` in sync when the policy changes.
- Homepage URL is the repository; Support URL should be the **Issues** page, not the repository root.

## Package

- 如果草稿已上传 v1.1.1 package，**不需要再次上传**。
- 如果需要重新上传，使用 `dist/zhibo8-modern-v1.1.1.zip`（由 `scripts/package.sh` 重新生成）。
- 不要在本次上架中混入 v1.2.0 的直播/资讯改动；当前主线是 v1.1.1。

## 文案速览

- 标题：`直播吧 Modern — Zhibo8 现代主题`
- 摘要（package 当前值）：`为直播吧首页带来现代布局、精简导航与明暗主题，其他页面保持原样。开源、无追踪。`
- 分类：Tools
- 语言：Chinese (China)

## 图片规格

- 5 张 screenshots：1280×800，24-bit RGB PNG（无 alpha）。
- 小宣传图：440×280，RGB PNG。
- Marquee：1400×560，RGB PNG。
- 图标：128×128。

## 合规提醒

- 商品说明、隐私说明和测试说明均明确：这是非官方开源项目，与直播吧无隶属关系。
- 只改首页；子页面保持原站，不宣称全站适配。
- 不使用“官方”“最佳”等可能误导的表述。
