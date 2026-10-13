# 离线朗读 / Offline speech

0.3.0 的原文朗读默认优先使用本地神经语音。在「设置 → 朗读」点击「下载自然语音包」，下载约 381 MiB 的 Supertonic 3 模型。下载显示进度，可以取消；失败可重试，逐文件检查大小和 SHA-256，完整核验后才安装。初次合成需载入模型，按钮显示准备状态，可再次点击取消。

下载后无需联网、API 密钥、Python 或显卡；文字与录音不上传。四个声音 F1、F2、M1、M2 分别为两个女声、两个男声，在设置中选择语言和声音，试听并调整语速。重复内容使用本地音频缓存；神经音频缓存最多 128 MiB。自己的录音、学习包作者录音始终优先。

模型支持 31 门语言，其中 Qonsona 的内置日语、英语、法语、韩语、西班牙语、阿拉伯语和俄语可使用神经朗读。它不声明支持苏格兰盖尔语、昆雅语、辛达语或任意 IPA；这些语言请使用录音或明确标示的音素近似。没有匹配语言时不改用英语声音。未下载模型时可使用已安装的匹配语言系统声音；机械 eSpeak 原文语音需要明确选择。神经语音是人工合成，不是真人示范；纯 IPA 使用独立的 eSpeak-NG 音素引擎，不等同于自然神经语音。

「移除语音包」释放模型文件；不会删除录音、笔记或学习记录。模型在数据目录的 `speech-models/supertonic3` 下，缓存另在 `speech-models/audio-cache`。模型不放进个人 JSON 转移文件或完整学习数据备份，换电脑后需重新下载。

## Sources and licences / 来源与许可

- [Supertonic 3 官方归档模型](https://huggingface.co/supertone-oss-archive/supertonic-3)；固定快照 `aafc6e32416a594460b32413efc49d7fe4ce6d46`，权重与声音文件为 [BigScience Open RAIL-M](https://huggingface.co/supertone-oss-archive/supertonic-3/blob/aafc6e32416a594460b32413efc49d7fe4ce6d46/LICENSE)。完整原许可证及模型说明随模型下载保存。归档项目没有持续官方开发保障，固定校验值避免自动换成未知权重。
- [官方 Node 示例](https://github.com/supertone-oss-archive/supertonic/tree/main/nodejs)为 MIT；本应用保留原许可，并修改运行库注入、输入检查、长文分段和资源限制。模型许可与示例代码许可分别适用。
- [ONNX Runtime Node](https://onnxruntime.ai/docs/get-started/with-javascript/node.html) 1.21.0，MIT；CPU 原生库随安装包提供，完整运行库及许可保留。Windows x64 与 macOS x64/arm64 均核对二进制架构和 ASAR 外资源，CI 执行所在宿主架构的 CPU 推理检查。Windows 真实打包语音已本机验收；未声称完成 macOS 本机听音验收。
- 独立 eSpeak-NG 音素进程与供应库使用 GPL-3.0，保留 `resources/speech/espeak` 的原许可和说明。它保留可支持的音素差异，并对不支持的 IPA 报错，但仍是机械近似。

## English

In Settings → Speech, download the verified Supertonic 3 voice pack (about 381 MiB). Once installed, synthesis runs locally on CPU without an API key, Python, a GPU or an internet connection. Text and recordings are not uploaded. Choose two female or two male voices, preview them and adjust the rate. Downloads and synthesis can be cancelled; repeated text is cached within a 128 MiB neural-audio cache limit.

The model supports 31 languages, including seven built-in natural languages: Japanese, English, French, Korean, Spanish, Arabic and Russian. Scottish Gaelic, Quenya, Sindarin and general IPA are outside its declared support. Recordings remain first choice; pure IPA uses the separate mechanical phonetic approximation. Matching system voices can be used before downloading the pack; mechanical text voices require explicit selection, and English is never substituted for another language.

Model files are excluded from learning-data backups and transfers; download them again on another computer. Removal affects the model, not recordings or study progress. The archived model uses Open RAIL-M; its sample code and ONNX Runtime use MIT. Original licences and model documentation are preserved. Neural speech is synthetic, and a successful waveform test does not establish expert pronunciation accuracy for every word.
