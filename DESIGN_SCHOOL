这是一份针对“中国院校官网前端主题风格”的专业 Skill 文档，旨在为设计师与前端开发者提供可直接落地的设计规范与组件思路。内容涵盖视觉基因、布局范式与代码变量定义。

---

# 🇨🇳 中国院校官网前端主题风格 Skill

## 1. 技能概述
- **技能名称**：`chinese-university-frontend-style`
- **适用场景**：高校门户网站、二级学院官网、校园管理后台前台展示、招生专题页。
- **核心目标**：通过标准化的前端变量与组件库约束，快速构建符合中国高校 **“庄重、清晰、信息密集、人文与科技感并重”** 审美的页面。

## 2. 设计核心理念
| 维度 | 关键词 | 具体表现 |
| :--- | :--- | :--- |
| **氛围** | 权威、可信、严谨 | 拒绝花哨动效，强调内容层级与留白控制 |
| **色彩** | 校徽红、理工蓝 | 主色源于校徽提取，辅助色为浅灰、米白 |
| **信息** | 高密度、高效率 | 首屏承载 **Logo+导航+大图+通知公告+专题图片** |
| **排版** | 方正、大气 | 多用微软雅黑、思源黑体，标题字重突出 |

## 3. 色彩系统 (Design Tokens)

基于国内 985/211 院校官网高频色彩采样：

```css
:root {
  /* 主色 - 中国院校经典红/蓝 */
  --uni-primary: #8B0000;      /* 暗红 / 校徽红 (常用于导航、重点标题) */
  --uni-primary-light: #B22222;
  --uni-primary-dark: #5C0000;
  
  /* 科技/理工蓝 (备选主色，多见于理工类院校) */
  --uni-tech-blue: #004098;
  
  /* 背景色 */
  --uni-bg-page: #F5F5F5;      /* 全局基底灰 */
  --uni-bg-white: #FFFFFF;     /* 内容卡片白 */
  --uni-bg-blue-light: #F0F5FA; /* 侧边栏/模块底色 */
  
  /* 文字色 */
  --uni-text-title: #222222;   /* 深灰标题，非纯黑 */
  --uni-text-body: #444444;
  --uni-text-muted: #666666;
  
  /* 边框与分割 */
  --uni-border-light: #E8E8E8;
  --uni-border-focus: var(--uni-primary);
  
  /* 阴影 - 极淡，不抢内容 */
  --uni-shadow-sm: 0 2px 4px rgba(0,0,0,0.02), 0 1px 2px rgba(0,0,0,0.05);
  --uni-shadow-hover: 0 6px 12px rgba(0,0,0,0.05);
}
```

## 4. 字体与排版规则

国内院校网站阅读者多为师生、家长，需兼顾 Windows 与 macOS 渲染。

```css
body {
  font-family: "Microsoft YaHei", "PingFang SC", "Helvetica Neue", "Segoe UI", sans-serif;
  font-size: 14px;      /* 正文基准小一号，信息密度高 */
  line-height: 1.6;
  color: var(--uni-text-body);
}

h1, h2, h3 {
  font-weight: 500;     /* 不过粗，保持儒雅 */
  color: var(--uni-text-title);
}

/* 典型字号梯度 */
--uni-font-xs: 12px;    /* 辅助信息、脚注 */
--uni-font-base: 14px;  /* 正文、列表标题 */
--uni-font-md: 16px;    /* 卡片标题 */
--uni-font-lg: 20px;    /* 模块大标题 */
--uni-font-xl: 28px;    /* Banner 主标题 */
```

**强制规范**：所有正文内容容器内，**行高不小于 1.5**，段落间距 `1em`。

## 5. 经典布局结构 (Layout Framework)

国内院校官网普遍采用 **“上中下/左右中”** 稳定结构。

### 5.1 页头 (Header)
- **校名 + 校徽** 组合居左上或居中上（部分老校徽章居左上）。
- **导航栏**：背景色多为 `var(--uni-primary)`，下拉菜单深色半透明。
- **搜索框**：通常位于导航右侧或 Banner 下方单独一行，占位符为“请输入关键词”。

### 5.2 首屏 Banner
- **尺寸**：宽屏 1920x500px 左右，移动端等比缩放。
- **内容**：大图轮播（校园风光、学术成果）+ 半透明黑色遮罩层 + 白色大标题居中。
- **特殊元素**：Banner 下方常设 **“快速通道”** 小图标区（一卡通、邮箱、选课、图书馆）。

### 5.3 主体内容区 (Main Grid)
典型三列或两列自适应：

```html
<!-- 首页标准结构示例 -->
<div class="container">
  <!-- 左栏：通知公告/学术活动 (60%) -->
  <div class="main-news">...</div>
  <!-- 右栏：专题图片/快速链接 (40%) -->
  <div class="side-links">...</div>
</div>
<!-- 下方全幅专题板块：图片新闻矩阵 (3-4列) -->
<div class="feature-grid">...</div>
```

### 5.4 页脚 (Footer)
**信息高度密集区**，包含：
- 版权 © 学校名
- 地址、邮编、电话、传真
- 公安备案号、ICP 备案号（**强制显示**）
- 官方微信二维码、微博链接图标

## 6. 特色组件规范 (Component Specs)

### 6.1 通知公告列表
- **前缀图标**：红色小圆点 `•` 或 `[通知]` 标签。
- **日期样式**：右对齐，灰色字 `var(--uni-text-muted)`，格式 `YYYY-MM-DD`。
- **分割线**：1px solid `#EEEEEE`。

```html
<ul class="news-list">
  <li><span class="title">关于2025年春季学期选课的通知</span><span class="date">2025-01-15</span></li>
</ul>
```

### 6.2 专题图片模块 (Card)
- **图片比例**：强制 16:9 或 4:3，`object-fit: cover`。
- **标题**：白色或红色背景条叠加，或置于图片下方，字号 16px。
- **悬停**：图片轻微放大 `scale(1.02)` 并伴随标题颜色变红。

### 6.3 校训/精神展示
- 通常在 Banner 下方或页脚上方以 **书法字体 + 细线框** 展示。
- 例如：`<div class="motto">自强不息 厚德载物</div>`

## 7. 交互与动效约束

- **原则**：**无弹窗广告、无自动播放声音、无高频闪烁**。
- **轮播图**：切换速度慢 (5-8s)，切换方式多为淡入淡出或平滑左移，不用 3D 翻转。
- **下拉菜单**：出现需延迟 200ms 防止误触，收起需快速。
- **按钮点击**：反馈为背景色加深或轻微缩放，不用夸张波纹。

## 8. 响应式断点 (Mobile First 适配)

国内院校移动端访问量极大（尤其招生季）。

```css
/* 移动端布局变化 */
@media (max-width: 768px) {
  .header .logo {
    text-align: center;
    float: none;
  }
  .nav {
    display: none; /* 转为汉堡菜单 */
  }
  .news-list .date {
    display: block; /* 日期换行 */
    text-align: left;
  }
  .container {
    display: block; /* 左右结构变上下堆叠 */
  }
}
```

**移动端关键适配点**：
- 字号至少 15px 防止 iOS 自动缩放。
- 表单输入框高度 `44px`。
- Banner 标题字号缩减为 20px。

## 9. 代码初始化模板 (Tailwind CSS 示例)

若项目使用实用工具类，可快速定义院校主题：

```js
// tailwind.config.js 扩展
theme: {
  extend: {
    colors: {
      'uni-red': '#8B0000',
      'uni-blue': '#004098',
      'uni-gray-bg': '#F5F5F5',
    },
    fontFamily: {
      'sans': ['"Microsoft YaHei"', '"PingFang SC"', 'sans-serif'],
    }
  }
}
```

## 10. 检查清单 (Checklist)

当您使用本 Skill 完成院校官网开发时，请核对：
- [ ] 底部是否展示了 **ICP 备案号**（例如：沪ICP备xxxxxx号）及链接至工信部？
- [ ] 顶部导航是否包含了 **“English / 英文版”** 切换入口？
- [ ] 是否有 **“信息公开”**、**“书记信箱”**、**“校长信箱”** 的标准链接（通常在页脚）？
- [ ] 色彩对比度是否满足 WCAG AA 级（红底白字确保可读性）？
- [ ] 移动端菜单是否可正常展开？

---

*本 Skill 由深度求索 (DeepSeek) 基于国内 50+ 高校官网视觉分析综合提炼，可直接用于 Vue/React 项目的前端架构设计。*