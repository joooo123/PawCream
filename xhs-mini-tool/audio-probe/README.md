# 小红书小工具 Web Audio 兼容性实验

此目录是与 PawCream 正式播放器隔离的最小测试页。仅将 `index.html` 与 `app.js` 放在 ZIP 根目录上传。

测试 A：用户手势触发 AudioContext + OscillatorNode。
测试 B：用户手势触发 JS 生成的 PCM AudioBuffer + AudioBufferSourceNode。

不包含任何 MP3、data:/blob: 媒体源、外部请求、动态代码执行或版权歌曲。
官方文档仅确认 HTML audio 支持，并未明确保证 AudioContext：通过浏览器测试不意味着真机通过。

使用小红书创服平台模拟器、Android 真机、iOS 真机分别确认实际能否听到声音。记录设备及 App 版本和页面诊断结果。
