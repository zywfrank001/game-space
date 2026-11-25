好，Fork 确认没问题 👍

现在给你一份**完整的 `Spec.md`**，你直接复制到仓库根目录，或者发给 WorkBuddy / CodeBuddy 执行。这份文档包含了你所有的决策、架构、卖点、合规策略、执行步骤，Agent 读完就能干活。

---

```markdown
# Spec.md — Game-Space 长期运营项目

## 一、项目定位

**一句话**：打开即玩、进度永存、零广告打扰的轻量网页游戏空间。

**核心卖点**：不是"玩多少游戏"，而是"你的进度有人管"。
- 游戏是别人的（开源 H5），但存档、体验、连续性是你的
- 用户在一个站玩了 3 个月、攒了 20 款游戏进度 → 迁移成本极高 → 这就是护城河
- 价值主张："你只管玩，进度交给我。"

**技术路线**：纯网页 H5 + PWA，不做 APP。小程序远期备选（需 ICP 备案，暂不启动）。

**运营策略**：零推广成本、小流量、高留存、订阅制微 SaaS。

**成本**：首年 ≈ 80 元（域名），其余走 Cloudflare 免费额度。

---

## 二、仓库信息

- Fork 源：https://github.com/chengzuopeng/game-space
- 你的仓库：https://github.com/zywfrank001/game-space
- 分支：main
- 结构：扁平化，每款游戏独立目录（1-僵尸鸭猎手/ 到 60-复活节记忆/）
- Fork 后独立，不受上游影响，可放心修改

---

## 三、技术架构

```
用户端（手机浏览器 / 桌面 / PWA 添加到桌面）
        ↓
CF Pages（纯静态前端）
├── 首页：精选推荐 + 最近玩 + 分类入口
├── /play/[游戏目录名]/ → 游戏 + 统一外壳
│   ├── 自动存档（localStorage → 登录后同步云端）
│   ├── 暂停/全屏/音量/触屏适配
│   └── 结束页：成绩 + 分享 + "存到云端"按钮
├── /guide/[游戏名].html → SEO 攻略页
├── /daily/ → 每日挑战
├── /dashboard/ → 个人数据看板（付费）
└── /pricing/ → 会员方案
        ↓
CF Workers + KV（轻 API，免费额度内）
├── /api/auth → 注册/登录/JWT
├── /api/save → 存档 CRUD
├── /api/export → 存档码导出
├── /api/import → 导入存档码
├── /api/score → 分数/榜单
└── /api/sub → 订阅状态查询
        ↓
支付（后期接入）
└── 支付宝当面付 / Stripe → Webhook → KV is_pro=true
```

---

## 四、部署配置

### CF Pages 设置

| 项 | 值 |
|---|---|
| 仓库 | zywfrank001/game-space |
| 生产分支 | main |
| Framework preset | None |
| Build command | 留空 |
| Build output directory | / |
| Root directory | 留空 |

### 根目录必须文件

`_redirects`：
```
/*    /index.html   200
```

`_headers`：
```
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin

/assets/*
  Cache-Control: public, max-age=31536000, immutable
```

### 自定义域名

绑定 `play.你的域名.com`（或新购短域名），CF 自动 CNAME + SSL。

---

## 五、产品改造（MVP 阶段）

### 5.1 首页（index.html）

- 顶部：精选 3 款游戏卡片（推荐：17-吃水果的蛇、3-坦克大战、黄金矿工）
- 中部：场景分类标签（摸鱼解压 / 烧脑挑战 / 双人同屏 / 怀旧街机）
- 右下角："最近玩"悬浮球（从 localStorage 读取）
- 底部：全部游戏折叠入口 + footer 版权声明

### 5.2 统一游戏外壳

每个游戏通过 iframe 或 wrapper 加载，外壳提供：
- 自动存进度（每 30 秒 + 游戏结束时，写 localStorage）
- 暂停遮罩层
- 全屏按钮
- 移动端虚拟按键
- 结束页：成绩展示 + "存到云端"CTA

### 5.3 存档逻辑

```javascript
// 未登录：localStorage，key = save_{gameId}
// 登录后：localStorage → 同步到 /api/save → KV
// 存档结构：{ game, data: {...}, saved_at }
// 支持导出存档码（Base64 编码，可复制/导入）
```

### 5.4 会员入口（先挂按钮，不接支付）

免费用户：本地存档 + 零广告（前 3 个月完全无广告）
付费用户：云端存档 + 去广告 + 数据看板 + 成就 + 优先体验

定价：¥6.9/月 · ¥29/半年 · ¥49/年 · ¥19.9 永久买断

按钮先跳 `#soon`，收集点击数据验证需求。

### 5.5 PWA

- `manifest.json`：name、icons、display: standalone
- `sw.js`：缓存核心游戏资源，离线可玩
- `<meta>` apple-touch-icon

---

## 六、版权与合规

| 类型 | 处理方式 |
|------|---------|
| 开源游戏（MIT/Apache/GPL） | 注明 license + 原作者链接 |
| 无明确协议 | 注明"学习用途/非商业"，加原作者链接 |
| 商业素材 | 不碰，用开源替代 |
| 自研/AI 改版 | 逐步替换，降低版权风险 |

- footer 固定文字："游戏素材来源于开源社区，仅供学习娱乐"
- 每款游戏页面标注原作者 + 开源协议
- 不做"游戏下载"，只做"在线即玩"
- 商业化前逐一确认可商用或替换

---

## 七、SEO 策略

每款游戏拆页面：
- `/play/[游戏]` → 直接玩
- `/guide/[游戏].html` → 攻略/技巧/FAQ（结构化 Schema）
- `/daily/` → 每日挑战（固定种子）

搜索词覆盖：中文长尾（"不用下载的小游戏""摸鱼小游戏"）+ 爆款跟（Wordle/Queens 等）

内容分发：知乎回答、小红书截图、GitHub README 挂在线体验地址、允许 iframe 嵌入（带水印）

---

## 八、后端 API（CF Workers + KV）

### KV 命名空间

```
USER_KV    → user:{email} → {hash, is_pro, expire, created}
SAVE_KV    → save:{user_id}:{game} → {data, updated_at}
EXPORT_KV  → export:{code} → {user_id, saves, expire}
SCORE_KV   → score:{game}:{user_id} → {score, date}
```

### Worker 路由

| 路径 | 方法 | 功能 |
|------|------|------|
| /api/register | POST | 注册 |
| /api/login | POST | 登录 → JWT |
| /api/save | POST | 存存档 |
| /api/save/:game | GET | 取存档 |
| /api/export | GET | 生成存档码 |
| /api/import | POST | 导入存档码 |
| /api/score | POST | 提交分数 |
| /api/sub | GET | 订阅状态 |

免费额度：Workers 10万次/天，KV 读10万/天、写1000/天、存储1GB。

---

## 九、支付接入（验证有需求后再做）

1. 先挂按钮 2–4 周，看点击率
2. 接支付宝当面付（个人可申）
3. Webhook → KV is_pro=true
4. 前端根据 is_pro 解锁功能

---

## 十、执行优先级

### P0（本周，先把东西跑起来）
- [ ] 确认 CF Pages 部署成功，拿到 pages.dev 域名
- [ ] 绑自定义域名
- [ ] 加 _redirects + _headers
- [ ] 首页改为精选 3 款 + 最近玩入口 + 分类标签

### P1（第 2 周，留存基础）
- [ ] 统一游戏外壳（自动 localStorage 存档）
- [ ] 会员入口页面（挂价格，按钮跳 #soon）
- [ ] PWA manifest + sw.js
- [ ] 游戏结束页加"存到云端"CTA

### P2（第 3 周，后端 + SEO）
- [ ] CF Worker + KV 用户/存档 API
- [ ] 登录后云端同步
- [ ] 3 款游戏攻略页（SEO）

### P3（第 4 周+，商业化 + 扩展）
- [ ] 接支付
- [ ] SEO 铺量（剩余游戏页面）
- [ ] 每日挑战 + 成就系统
- [ ] 数据分析埋点（CF Web Analytics）

---

## 十一、成功指标

| 指标 | 健康线 |
|------|--------|
| 次日留存 | >30% |
| 7日留存 | >15% |
| 存档使用率 | >40% 用户触发过存档 |
| 付费转化率 | 1–3% |
| 月收入 | ¥1000–3000（小流量模型） |
| 运维成本 | <¥100/年 |

---

## 十二、关键决策记录

- 不做 APP（网页 PWA 足够，降低 friction）
- 小程序暂不启动（需 ICP 备案 + 微信认证 + 可能需版号）
- 不买 VPS（CF 免费额度够用，流量起来再评估）
- 前期零广告（靠体验留人，不是靠广告变现）
- 版权：注明来源 + 非商业，商业化前替换素材
- Fork 后独立修改，不 Sync upstream，避免覆盖
```

---

把这段存为 `Spec.md` 放到仓库根目录，Agent 读到就能按 P0→P3 顺序执行。

**有一个点确认一下**：你 CF Pages 部署的时候，Build output directory 填 `/`（英文句点也行，但 `/` 更稳），别填 `dist` 或 `public`，否则 404。这个坑最多人踩，Agent 如果搞错了你直接说"output directory 应该是 /"。

还有别的要调整的随时说。