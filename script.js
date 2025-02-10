// 获取DOM元素
const modelAKey = document.getElementById('modelA-key');
const modelBKey = document.getElementById('modelB-key');
const imageUpload = document.getElementById('image-upload');
const preview = document.getElementById('preview');
const userPrompt = document.getElementById('user-prompt');
const analyzeBtn = document.getElementById('analyze-btn');
const modelAResult = document.getElementById('modelA-result');
const modelBResult = document.getElementById('modelB-result');
const modelASelect = document.getElementById('modelA-select');
const modelBSelect = document.getElementById('modelB-select');

// 添加本地存储相关功能
const STORAGE_KEYS = {
    MODEL_A: 'modelA-selection',
    MODEL_B: 'modelB-selection',
    API_A: 'modelA-apikey',
    API_B: 'modelB-apikey'
};

// 保存状态到本地存储
function saveState() {
    localStorage.setItem(STORAGE_KEYS.MODEL_A, modelASelect.value);
    localStorage.setItem(STORAGE_KEYS.MODEL_B, modelBSelect.value);
    localStorage.setItem(STORAGE_KEYS.API_A, modelAKey.value);
    localStorage.setItem(STORAGE_KEYS.API_B, modelBKey.value);
}

// 从本地存储恢复状态
function restoreState() {
    const savedModelA = localStorage.getItem(STORAGE_KEYS.MODEL_A);
    const savedModelB = localStorage.getItem(STORAGE_KEYS.MODEL_B);
    const savedApiA = localStorage.getItem(STORAGE_KEYS.API_A);
    const savedApiB = localStorage.getItem(STORAGE_KEYS.API_B);

    if (savedModelA) modelASelect.value = savedModelA;
    if (savedModelB) modelBSelect.value = savedModelB;
    if (savedApiA) modelAKey.value = savedApiA;
    if (savedApiB) modelBKey.value = savedApiB;
}

// 添加状态变化监听器
modelASelect.addEventListener('change', saveState);
modelBSelect.addEventListener('change', saveState);
modelAKey.addEventListener('input', saveState);
modelBKey.addEventListener('input', saveState);

// 页面加载时恢复状态
document.addEventListener('DOMContentLoaded', restoreState);

// 添加清除历史记录功能
function clearHistory() {
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
    modelASelect.value = modelASelect.options[0].value;
    modelBSelect.value = modelBSelect.options[0].value;
    modelAKey.value = '';
    modelBKey.value = '';
}

// 绑定清除历史按钮事件
document.getElementById('clear-history').addEventListener('click', () => {
    if (confirm('确定要清除所有历史记录吗？')) {
        clearHistory();
    }
});

// 图片预览功能
imageUpload.addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (file) {
        try {
            const imageData = await processSingleImage(file);
            preview.innerHTML = `<img src="${imageData}" alt="预览图片">`;
        } catch (error) {
            alert(error.message);
            this.value = ''; // 清除选择
        }
    }
});

// 添加用于处理流式输出的辅助函数
function createStreamHandler(elementId) {
    const element = document.getElementById(elementId);
    let contentBuffer = '';
    let reasoningBuffer = '';
    
    return {
        handleChunk: (chunk) => {
            try {
                if (chunk.choices[0].delta?.content) {
                    contentBuffer += chunk.choices[0].delta.content;
                    element.innerHTML = `<pre>${contentBuffer}</pre>`;
                }
                if (chunk.choices[0].delta?.reasoning_content) {
                    reasoningBuffer += chunk.choices[0].delta.reasoning_content;
                    element.innerHTML = `<pre>推理过程：\n${reasoningBuffer}\n\n最终答案：\n${contentBuffer}</pre>`;
                }
            } catch (error) {
                console.error('处理数据块时出错:', error);
            }
        },
        getResult: () => ({
            content: contentBuffer || '无内容',
            reasoning: reasoningBuffer || '无推理过程'
        })
    };
}

// 修改Model A的图片分析API调用
async function analyzeImage(imageData, apiKey) {
    try {
        const API_URL = 'https://api.siliconflow.cn/v1/chat/completions';
        const headers = {
            'Authorization': `Bearer ${apiKey.trim()}`,  // 确保API密钥没有多余空格
            'Content-Type': 'application/json'
        };

        // 更新请求体格式以匹配API要求
        const requestBody = {
            model: modelASelect.value,
            temperature: 0.7,
            top_p: 0.9,
            max_tokens: 2000,
            stream: true,
            messages: [{
                role: "user",
                content: [
                    {
                        type: "text",
                        text: "请分析这张图片的场景描述、主要物体和颜色特征。"
                    },
                    {
                        type: "image_url",
                        image_url: {
                            url: imageData
                        }
                    }
                ]
            }]
        };

        // 调试日志
        console.log('Request Body:', JSON.stringify({
            ...requestBody,
            messages: [{
                ...requestBody.messages[0],
                content: [
                    requestBody.messages[0].content[0],
                    { type: "image_url", image_url: { url: "[图片数据]" } }
                ]
            }]
        }, null, 2));

        const response = await fetchWithRetry(API_URL, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`API调用失败: ${response.status}`);
        }

        if (!response.body) {
            throw new Error('Response body is null');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const streamHandler = createStreamHandler('modelA-result');
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                    const data = JSON.parse(line.slice(6));
                    streamHandler.handleChunk(data);
                }
            }
        }

        const result = streamHandler.getResult();
        return {
            description: result.content,
            objects: result.content.match(/物体[：:](.*?)(?=[。\n]|$)/)?.[1]?.split(/[,，、]/).map(item => item.trim()).filter(Boolean) || [],
            colors: result.content.match(/颜色[：:](.*?)(?=[。\n]|$)/)?.[1]?.split(/[,，、]/).map(item => item.trim()).filter(Boolean) || []
        };

    } catch (error) {
        console.error('图片分析详细错误:', error);
        modelAResult.innerHTML = `错误信息: ${error.message}<br>请检查:<br>1. API密钥是否正确<br>2. 网络连接是否正常<br>3. 图片格式是否支持`;
        throw error;
    }
}

// 修改Model B的解答API调用
async function generateAnswer(analysisResult, prompt, apiKey) {
    try {
        const API_URL = 'https://api.siliconflow.cn/v1/chat/completions';
        const headers = {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        };

        // 构建系统提示和用户提示
        const messages = [
            {
                role: "system",
                content: "你是一个专业的图像分析助手，���要基于图像分析结果回答用户问题。"
            },
            {
                role: "user",
                content: `基于以下图像分析结果：
场景描述：${analysisResult.description}
识别的物体：${analysisResult.objects.join('、')}
主要颜色：${analysisResult.colors.join('、')}

用户问题：${prompt}`
            }
        ];

        // 构建请求体
        const requestBody = {
            model: modelBSelect.value, // 使用选择的推理模型
            messages: messages,
            max_tokens: 4096,
            temperature: 0.7,
            stream: true  // 启用流式输出
        };

        // 显示请求信息（开发调试用）
        console.log('发送请求到Model B:', {
            url: API_URL,
            model: modelBSelect.value,
            requestBody
        });

        const response = await fetchWithRetry(API_URL, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`API调用失败: ${response.status}`);
        }

        if (!response.body) {
            throw new Error('Response body is null');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const streamHandler = createStreamHandler('modelB-result');
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                    const data = JSON.parse(line.slice(6));
                    streamHandler.handleChunk(data);
                }
            }
        }

        return ''; // 流式输出已经实时显示，不需要返回内容
    } catch (error) {
        console.error('生成回答详细错误:', error);
        modelBResult.innerHTML = `错误信息: ${error.message}<br>请检查:<br>1. API密钥是否正确<br>2. 网络连接是否正常`;
        throw error;
    }
}

// 处理分析按钮点击事件
analyzeBtn.addEventListener('click', async () => {
    // 验证输入
    if (!modelAKey.value || !modelBKey.value) {
        alert('请输入两个模型的API密钥');
        return;
    }
    if (!imageUpload.files[0]) {
        alert('请选择要分析的图片');
        return;
    }

    try {
        analyzeBtn.disabled = true;
        analyzeBtn.textContent = '分析中...';
        updateLoadingState(modelAResult, true, '正在分析图片...');
        updateLoadingState(modelBResult, true, '等待分析完成...');

        // 调用Model A进行图片分析
        const imageData = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(imageUpload.files[0]);
        });

        const analysisResult = await analyzeImage(imageData, modelAKey.value);

        // 调用Model B生成解答
        const prompt = userPrompt.value || '请描述这张图片';
        await generateAnswer(analysisResult, prompt, modelBKey.value);

    } catch (error) {
        console.error('���理过程中详细错误:', error);
        modelAResult.innerHTML = error.message.includes('图片分析失败') ? 
            modelAResult.innerHTML : '处理失败<br>请查看控制台了解详细错误信息';
        modelBResult.innerHTML = error.message.includes('生成回答失败') ? 
            modelBResult.innerHTML : '处理失败<br>请查看控制台了解详细错误信息';
    } finally {
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = '开始分析';
    }
});

// 添加文件拖放支持
const previewContainer = document.querySelector('.preview-container');

previewContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    previewContainer.style.borderColor = 'var(--primary-color)';
    previewContainer.style.backgroundColor = 'rgba(52, 152, 219, 0.1)';
});

previewContainer.addEventListener('dragleave', (e) => {
    e.preventDefault();
    previewContainer.style.borderColor = 'var(--border-color)';
    previewContainer.style.backgroundColor = 'var(--secondary-color)';
});

previewContainer.addEventListener('drop', async (e) => {
    e.preventDefault();
    previewContainer.style.borderColor = 'var(--border-color)';
    previewContainer.style.backgroundColor = 'var(--secondary-color)';
    
    const file = e.dataTransfer.files[0];
    try {
        const imageData = await processSingleImage(file);
        preview.innerHTML = `<img src="${imageData}" alt="预览图��">`;
        imageUpload.files = e.dataTransfer.files;
    } catch (error) {
        alert(error.message);
    }
});

// 优化图片上传区域点击功能
previewContainer.addEventListener('click', () => {
    imageUpload.click();
});

// 修改加载状态显示
function updateLoadingState(element, isLoading, message) {
    if (isLoading) {
        element.innerHTML = `<div class="loading">${message}</div>`;
    }
}

// 优化图片处理函数
async function processSingleImage(file) {
    if (!file.type.startsWith('image/')) {
        throw new Error('请选择有效的图片文件');
    }
    
    if (file.size > 10 * 1024 * 1024) {
        throw new Error('图片大小不能超过10MB');
    }
    
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error('读取图片失败'));
        reader.readAsDataURL(file);
    });
}

// 修改API错误重试机制，增加错误详情输出
async function fetchWithRetry(url, options, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Error:', errorText);
                throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
            }
            return response;
        } catch (error) {
            console.error(`Attempt ${i + 1} failed:`, error);
            if (i === maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
}

// 更新图片上传处理相关代码
const uploadPlaceholder = document.querySelector('.upload-placeholder');

// 点击上传处理
previewContainer.addEventListener('click', () => {
    if (!imageUpload.files.length) { // 只在没有图片时触发点击
        imageUpload.click();
    }
});

// 优化预览显示功能
function updatePreview(imageData) {
    preview.innerHTML = `
        <img src="${imageData}" alt="预览图片">
        <div class="preview-overlay">
            <p><i class="fas fa-redo"></i> 点击更换图片</p>
        </div>
    `;
}

// 统一的图片处理函数
async function handleImageFile(file) {
    try {
        const imageData = await processSingleImage(file);
        updatePreview(imageData);
        // 创建新的 FileList 对象
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        imageUpload.files = dataTransfer.files;
    } catch (error) {
        alert(error.message);
        imageUpload.value = '';
    }
}

// 更新文件输入处理
imageUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        await handleImageFile(file);
    }
});

// 更新拖放处理
previewContainer.addEventListener('drop', async (e) => {
    e.preventDefault();
    previewContainer.style.borderColor = 'var(--border-color)';
    previewContainer.style.backgroundColor = 'var(--secondary-color)';
    
    const file = e.dataTransfer.files[0];
    if (file) {
        await handleImageFile(file);
    }
});

// 重构图片上传处理函数
async function handleImageUpload(file) {
    try {
        const imageData = await processSingleImage(file);
        updatePreview(imageData);
        
        // 直接设置 files
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        imageUpload.files = dataTransfer.files;
    } catch (error) {
        alert(error.message);
        imageUpload.value = '';
    }
}

// 简化事件监听器
imageUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        handleImageUpload(file);
    }
});

previewContainer.addEventListener('click', () => {
    if (!imageUpload.files.length) {
        imageUpload.click();
    }
});

previewContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    previewContainer.style.borderColor = 'var(--primary-color)';
    previewContainer.style.backgroundColor = 'rgba(52, 152, 219, 0.1)';
});

previewContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    previewContainer.style.borderColor = 'var(--border-color)';
    previewContainer.style.backgroundColor = 'var(--secondary-color)';
    
    const file = e.dataTransfer.files[0];
    if (file) {
        handleImageUpload(file);
    }
});

// 优化预览更新函数
function updatePreview(imageData) {
    preview.innerHTML = `
        <img src="${imageData}" alt="预览图片" style="max-width:100%; max-height:400px;">
        <div class="preview-overlay">
            <p><i class="fas fa-redo"></i> 点击更换图片</p>
        </div>
    `;
}

// 简化图片处理核心函数
async function handleImageUpload(file) {
    try {
        if (!file.type.startsWith('image/')) {
            throw new Error('请选择有效的图片文件');
        }
        
        if (file.size > 10 * 1024 * 1024) {
            throw new Error('图片大小不能超过10MB');
        }

        const reader = new FileReader();
        const imageData = await new Promise((resolve, reject) => {
            reader.onload = e => resolve(e.target.result);
            reader.onerror = () => reject(new Error('读取图片失败'));
            reader.readAsDataURL(file);
        });

        // 更新预览
        preview.innerHTML = `
            <img src="${imageData}" alt="预览图片">
            <div class="preview-overlay">
                <p><i class="fas fa-redo"></i> 点击更换图片</p>
            </div>
        `;

        // 更新文件输入
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        imageUpload.files = dataTransfer.files;

        return imageData;
    } catch (error) {
        alert(error.message);
        imageUpload.value = '';
        preview.innerHTML = `
            <div class="upload-placeholder">
                <i class="fas fa-image fa-3x"></i>
                <p><i class="fas fa-plus-circle"></i> 点击或拖放图片到此处</p>
                <small>支持jpg、png格式，大小不超过10MB</small>
            </div>
        `;
        throw error;
    }
}

// 统一的事件处理器
function initImageUploadHandlers() {
    // 文件选择处理
    imageUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            await handleImageUpload(file);
        }
    });

    // 点击上传区域
    previewContainer.addEventListener('click', (e) => {
        // 避免重复触发
        if (!imageUpload.files.length || e.target.closest('.preview-overlay')) {
            imageUpload.click();
        }
    });

    // 拖放处理
    previewContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        previewContainer.style.borderColor = 'var(--primary-color)';
        previewContainer.style.backgroundColor = 'rgba(52, 152, 219, 0.1)';
    });

    previewContainer.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        previewContainer.style.borderColor = 'var(--border-color)';
        previewContainer.style.backgroundColor = 'var(--secondary-color)';
    });

    previewContainer.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        previewContainer.style.borderColor = 'var(--border-color)';
        previewContainer.style.backgroundColor = 'var(--secondary-color)';
        
        const file = e.dataTransfer.files[0];
        if (file) {
            await handleImageUpload(file);
        }
    });
}

// 初始化图片上传处理
initImageUploadHandlers();

// 移除重复的事件监听器和函数
// 删除: processSingleImage, updatePreview, handleImageFile 等重复函数