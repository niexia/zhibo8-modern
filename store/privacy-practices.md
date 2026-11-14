# Chrome Web Store Privacy practices

以下是 Privacy 标签页可用的填写内容。实际选项名称可能因控制台版本略有不同，但内容对应如下。

## Single purpose

在直播吧首页提供可选的现代主题、精简顶部导航、明暗主题和比赛日速览，同时保持原站内容、链接和交互不变。

## Permission justification

### storage
保存用户偏好：是否启用主题、跟随系统/浅色/深色、是否精简顶部导航、是否显示首页比赛日速览。设置仅保存在 `chrome.storage.sync`，用于在用户自己的 Chrome 设备之间同步；扩展开发者无法访问，不用于分析、广告或出售数据。

### Host permission — `https://zhibo8.com/*`、`https://www.zhibo8.com/*`
内容脚本只在直播吧首页路径真正执行，读取页面 DOM 结构以套用 CSS 主题、生成首页比赛日速览，并在导航栏注入主题开关。`content.js` 在非首页路径立即退出，不改动子页面。扩展不会读取或上传 Cookie、账号信息、表单内容、浏览历史，也不会把网站内容发送到任何外部服务。

## Remote code

**No.** 所有 HTML、CSS、JavaScript 和图标都打包在扩展中；没有远程脚本、`eval` 或动态代码加载。

## User data

**No user data is collected or transmitted.**

- 扩展不包含分析、广告、遥测或第三方 SDK。
- 扩展本身不发起外部网络请求。
- 仅使用 `chrome.storage.sync` 保存上述四项偏好。
- 不读取 Cookie、账号、表单、浏览历史或位置。
- 不出售、不共享、不用于个性化广告。

如果表单要求选择数据类型，选择 **None / 不收集用户数据**；如果要求隐私政策 URL，填写：

`https://github.com/niexia/zhibo8-modern/blob/main/PRIVACY.md`

## Certification

- 遵守 Chrome Web Store Developer Program Policies。
- 不包含远程代码。
- 不包含欺骗性行为、隐藏功能或数据收集。
- 非官方项目；已在商品说明和隐私说明中明确与直播吧无隶属关系。
