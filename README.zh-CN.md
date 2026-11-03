# Light Up Corners · 点亮角落 — v0.1.0

给 VS Code 和 ChatGPT 桌面窗口的左上角加一片暗金色渐变，让叠在一起的深色窗口更容易区分。这是 GNOME Shell 桌面扩展。

## 安装前确认

```sh
gnome-shell --version
echo "$XDG_SESSION_TYPE"
```

当前验证环境是 **GNOME Shell 42.9 / X11**，包仅声明支持 GNOME 42。同为 Ubuntu 不代表桌面版本相同；其他 GNOME 版本、Wayland、分数缩放尚未验证，请先不要强行关闭版本检查安装。

匹配窗口标识 `code` 和 `Chatgpt`。ChatGPT 浏览器网页、其他发行方式或窗口标识不同的软件可能不会生效。

## 安装

在安装包所在目录执行：

```sh
gnome-extensions install ./light-up-corners@shuyu.shell-extension.zip
```

按 **Alt + F2 → 输入 r → 回车**，重载桌面后再执行：

```sh
gnome-extensions enable light-up-corners@shuyu
gnome-extensions info light-up-corners@shuyu
```

看到 `State: ENABLED` 后查看窗口左上角。更新安装用 `gnome-extensions install --force`，更新代码后也需要重载桌面。

如果装过此前的开发版，先关闭旧版，避免两层重叠：

```sh
gnome-extensions disable dark-gold-corners@qcraft.local
```

## 默认效果

- 横向长度 = 窗口所在显示器宽度 × 21.09375%。
- 纵向长度 = 横向长度 × 0.381966（黄金分割比例 0.618… 的平方）。
- 2560 宽屏幕对应约 540 × 206 像素；调整横向时纵向自动跟随。
- 圆角连续描边；当前窗口稍亮、后台窗口稍暗；全屏时隐藏。
- 不接收鼠标点击，不联网、不收集遥测、不读取剪贴板或应用内容。

## 关闭与卸载

```sh
gnome-extensions disable light-up-corners@shuyu
gnome-extensions uninstall light-up-corners@shuyu
```

## 反馈

反馈时提供：GNOME 版本、X11/Wayland、分辨率及缩放、哪个软件有问题，以及扩展错误输出：

```sh
gnome-extensions info light-up-corners@shuyu
gdbus call --session --dest org.gnome.Shell.Extensions --object-path /org/gnome/Shell/Extensions --method org.gnome.Shell.Extensions.GetExtensionErrors light-up-corners@shuyu
```

目前已验证原开发机的视觉效果、语法、Cairo 绘制，以及模拟分辨率变化和清理逻辑。其他机器的安装、实际切换分辨率仍待试用确认。

此项目使用 AI 辅助开发，源码随包提供，采用 MIT 许可证；发布维护者应阅读并理解实现。
