# Oracle ML Service Phase 2 - Annotate Feature

## 修改说明

### 已修改文件

#### 1. `ml_pipeline.py`
**新增 import：**
- `import io` - 用于 BytesIO
- `import numpy as np` - 用于数组操作

**新增函数：**

1. **`get_detections_with_boxes(image_path, pipeline)`**
   - 运行 MegaDetector 和 SpeciesNet 分类
   - 返回 `(tags, confidence, boxes_with_species)`
   - `boxes_with_species` 格式: `[(x1, y1, x2, y2, species, confidence), ...]`

2. **`annotate_image_path(image_path, pipeline)`**
   - 调用 `get_detections_with_boxes` 获取检测结果
   - 使用 cv2 在图像上绘制绿色矩形框和物种标签
   - 返回 `(tags, confidence, annotated_image_base64)`
   - 若没有检测到动物，返回原图 base64

3. **`annotate_video_path(video_path, pipeline)`**
   - 每秒抽取 1 frame（保持与 `/detect-video` 一致）
   - 对每个 frame 调用 `get_detections_with_boxes`
   - 在每个 frame 上绘制检测框和物种标签
   - 返回 `(tags, confidence, annotated_frames_base64_list, frames_processed)`
   - 聚合所有 frame 的 tags 和 confidence（confidence 取最大值）

#### 2. `app.py`
**修改 import：**
- 添加 `annotate_image_path, annotate_video_path` 到 ml_pipeline import

**新增 endpoint：**

**`POST /annotate`**
- 同时支持 image 和 video（根据 `file_type` 判断）
- 请求格式：
  ```json
  {
    "file_name": "test.jpg",
    "file_type": "image",
    "image_base64": "..."
  }
  ```
  或
  ```json
  {
    "file_name": "test.mp4",
    "file_type": "video",
    "video_base64": "..."
  }
  ```

- Image 响应格式：
  ```json
  {
    "tags": {...},
    "confidence": {...},
    "annotated_image_base64": "...",
    "source": "Oracle ML detection"
  }
  ```

- Video 响应格式：
  ```json
  {
    "tags": {...},
    "confidence": {...},
    "frames_processed": 5,
    "annotated_frames_base64": ["...", "..."],
    "source": "Oracle ML detection"
  }
  ```

### 保持不变
- `GET /health` - 健康检查端点
- `POST /detect` - Image 和 Video 检测（响应格式不变）
- `POST /detect-video` - Video 检测（响应格式不变）

---

## 本地测试步骤

### 1. 重新构建 Docker 镜像
```bash
cd /Users/eric/Desktop/5225A2/orc-ml-service- local/oracle-ml-service
docker build --no-cache -t oracle-ml-service:latest .
```

### 2. 运行容器
```bash
docker run --rm -p 8080:8080 oracle-ml-service:latest
```

### 3. 在新的终端中测试 /annotate image

#### 方法 A：使用 Python 测试脚本
```bash
cd /Users/eric/Desktop/5225A2/orc-ml-service- local/oracle-ml-service
python3 test_annotate_image.py
```
脚本会：
- 创建一个测试图片（100x100 红色）
- 发送到 `/annotate` endpoint
- 将注解后的图片保存到 `/tmp/annotated_image.jpg`

#### 方法 B：使用 curl
```bash
# 先创建 base64 编码的图片
python3 << 'EOF'
import base64
from PIL import Image

img = Image.new("RGB", (100, 100), color="red")
img.save("/tmp/test.jpg")

with open("/tmp/test.jpg", "rb") as f:
    b64 = base64.b64encode(f.read()).decode("utf-8")
    
with open("/tmp/image_payload.json", "w") as f:
    import json
    json.dump({
        "file_name": "test.jpg",
        "file_type": "image",
        "image_base64": b64
    }, f)
EOF

curl -X POST http://localhost:8080/annotate \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/image_payload.json | python3 -m json.tool
```

### 4. 测试 /annotate video

#### 方法 A：使用 Python 测试脚本
```bash
cd /Users/eric/Desktop/5225A2/orc-ml-service- local/oracle-ml-service
python3 test_annotate_video.py
```
脚本会：
- 创建一个测试视频（2 秒，FPS=1，所以 2 frames）
- 发送到 `/annotate` endpoint
- 将注解后的 frames 保存到 `/tmp/annotated_frame_0.jpg` 等

#### 方法 B：使用 curl
```bash
# 先创建 base64 编码的视频
python3 << 'EOF'
import base64
import cv2
import numpy as np

width, height = 100, 100
fourcc = cv2.VideoWriter_fourcc(*"mp4v")
writer = cv2.VideoWriter("/tmp/test.mp4", fourcc, 1, (width, height))

colors = [(0, 0, 255), (0, 255, 0)]
for i in range(2):
    frame = np.ones((height, width, 3), dtype=np.uint8)
    frame[:] = colors[i % len(colors)]
    writer.write(frame)
writer.release()

with open("/tmp/test.mp4", "rb") as f:
    b64 = base64.b64encode(f.read()).decode("utf-8")
    
with open("/tmp/video_payload.json", "w") as f:
    import json
    json.dump({
        "file_name": "test.mp4",
        "file_type": "video",
        "video_base64": b64
    }, f)
EOF

curl -X POST http://localhost:8080/annotate \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/video_payload.json | python3 -m json.tool
```

---

## 技术细节

### Bounding Box 绘制
- 使用 OpenCV `cv2.rectangle()` 绘制绿色矩形框（宽度=2）
- 在框的左上角绘制物种标签和 confidence score
- 标签背景为半透明绿色，文字为黑色

### 图像转换流程
- Image: PIL → numpy array → cv2 绘制 → PIL → JPEG → base64
- Video: OpenCV frame → PIL → numpy array → cv2 绘制 → PIL → JPEG → base64

### 性能考虑
- `/annotate` 会多次运行模型推理（相对于 `/detect` 多次绘图操作）
- 对于长视频，返回 base64 list 会占用较多内存
- 建议视频长度 < 5 分钟

---

## 错误处理

- `image_base64` / `video_base64` 缺失 → 400 Bad Request
- Base64 解码失败 → 400 Bad Request
- 视频无法打开 → 400 Bad Request
- 模型推理失败 → 500 Internal Server Error
- 未检测到动物 → 返回原图 / 原 frames（空检测结果）

---

## 注意事项

1. **不破坏现有接口**：
   - `/detect` 和 `/detect-video` 的响应格式完全不变
   - 只新增 `/annotate` endpoint

2. **复用现有逻辑**：
   - `annotate_image_path` 和 `annotate_video_path` 基于现有的 `get_detections_with_boxes`
   - MegaDetector 和 SpeciesNet 分类逻辑不变

3. **临时文件清理**：
   - 视频临时文件：`/tmp/input_video.mp4`
   - Frame 临时文件：`/tmp/frame_x.jpg`
   - 处理完后自动删除

4. **依赖**：
   - `opencv-python-headless` 已在 requirements.txt 中
   - `numpy` 已有（torch 依赖）
   - Dockerfile 已包含 `libgl1` 和 `libglib2.0-0`
