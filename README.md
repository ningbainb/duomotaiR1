# 小宁多模态R1项目

这是一个开源的多模态分析项目，支持用户配置两个AI模型的API密钥，用于图片分析和问答。

## 功能特点

- 支持图片上传和预览
- 可配置两个模型的API密钥
- 支持自定义提示语
- 实时显示分析结果
- 简洁易用的界面

## 使用方法

1. 下载或克隆项目到本地
2. 在浏览器中打开 `index.html` 文件
3. 输入两个模型的API密钥
4. 上传要分析的图片
5. （可选）输入额外的提示语
6. 点击"开始分析"按钮

## 配置说明

### 模型选择
- 模型A（视觉模型）支持：
  - Qwen2-VL-72B-Instruct
  - Qwen2-VL-7B-Instruct
  - InternVL2-Llama3-76B
  - InternVL2-26B

- 模型B（推理模型）支持：
  - DeepSeek-R1
  - DeepSeek-R1-Llama-70B
  - DeepSeek-R1-Qwen-32B
  - DeepSeek-R1-Qwen-14B

### API密钥配置
- Model A API密钥：用于图片分析的模型
- Model B API密钥：用于生成解答的模型

### 注意事项
- 目前版本使用模拟数据演示功能
- 实际使用时需要替换为真实的API调用
- 请确保API密钥的安全性

## 开发说明

### 文件结构
- `index.html`: 主页面
- `style.css`: 样式表
- `script.js`: JavaScript代码

### 技术栈
- HTML5
- CSS3
- JavaScript (ES6+)

## 贡献指南

欢迎提交Issue和Pull Request来改进项目。

## 许可证

MIT License