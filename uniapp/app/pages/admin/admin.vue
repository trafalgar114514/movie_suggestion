<template>
  <view class="container">
    <view v-if="!isAdmin" class="empty-card">
      <view class="empty-title">仅管理员可访问</view>
      <view class="empty-sub">请使用管理员账号登录后进入此页面。</view>
    </view>

    <view v-else>
      <view class="hero-card">
        <view class="hero-title">管理员中心</view>
        <view class="hero-subtitle">支持查看概览、封号/解封、授予管理员以及调整推荐算法权重。</view>
      </view>

      <view class="section-card">
        <view class="section-header">
          <view class="section-title">系统概览</view>
          <view class="section-link" @click="loadAll">刷新</view>
        </view>

        <view class="stats-grid">
          <view class="stat-card">
            <view class="stat-value">{{ overview.total_users || 0 }}</view>
            <view class="stat-label">总用户</view>
          </view>
          <view class="stat-card">
            <view class="stat-value">{{ overview.active_users || 0 }}</view>
            <view class="stat-label">活跃账号</view>
          </view>
          <view class="stat-card danger">
            <view class="stat-value">{{ overview.banned_users || 0 }}</view>
            <view class="stat-label">封禁账号</view>
          </view>
          <view class="stat-card admin">
            <view class="stat-value">{{ overview.admin_users || 0 }}</view>
            <view class="stat-label">管理员</view>
          </view>
        </view>

        <view class="behavior-summary" v-if="overview.behavior_summary && overview.behavior_summary.length">
          <view class="mini-title">用户行为统计</view>
          <view class="behavior-line" v-for="item in overview.behavior_summary" :key="item.behavior_type">
            {{ item.behavior_type }}：{{ item.total }}
          </view>
        </view>
      </view>

      <view class="section-card">
        <view class="section-header">
          <view class="section-title">推荐算法权重</view>
        </view>

        <view class="weight-item" v-for="item in weightFields" :key="item.key">
          <view class="weight-top">
            <view class="weight-title">{{ item.label }}</view>
            <input class="weight-input" type="digit" v-model="configForm[item.key]" />
          </view>
          <slider
            :value="Number(configForm[item.key])"
            :min="0"
            :max="1"
            :step="0.05"
            activeColor="#1f6fff"
            @change="handleWeightChange(item.key, $event)"
          />
        </view>

        <button class="primary-btn" @click="saveWeights">保存推荐权重</button>
        <view class="weight-tip">权重无需相加为 1，后端会自动归一化后生效。</view>
      </view>

      <view class="section-card">
        <view class="section-header">
          <view class="section-title">用户管理</view>
        </view>

        <view v-for="item in users" :key="item.username" class="user-row">
          <view class="user-main">
            <view class="user-name">{{ item.nickname }}（{{ item.username }}）</view>
            <view class="user-meta">状态：{{ item.status === 'active' ? '正常' : '已封禁' }} ｜ 身份：{{ item.role === 'admin' ? '管理员' : '普通用户' }}</view>
            <view class="user-meta">偏好：{{ formatPreference(item.preference_profile) }}</view>
          </view>
          <view class="user-actions">
            <button class="mini-btn warn" @click="toggleStatus(item)">
              {{ item.status === 'active' ? '封号' : '解封' }}
            </button>
            <button class="mini-btn" @click="toggleRole(item)">
              {{ item.role === 'admin' ? '取消管理' : '设为管理' }}
            </button>
          </view>
        </view>
      </view>

      <view class="section-card">
        <view class="section-header">
          <view class="section-title">最近管理员操作</view>
        </view>
        <view v-if="logs.length">
          <view v-for="item in logs" :key="item.id" class="log-row">
            <view class="log-title">{{ item.admin_username }} · {{ item.action_type }}</view>
            <view class="log-sub">目标：{{ item.target_username || '系统配置' }}</view>
            <view class="log-sub">时间：{{ formatTime(item.created_at) }}</view>
          </view>
        </view>
        <view v-else class="empty-sub">暂无管理员操作记录。</view>
      </view>
    </view>
  </view>
</template>

<script>
import { apiRequest } from '@/utils/api'
import { getCurrentUser, saveCurrentUser } from '@/utils/auth'

export default {
  data() {
    return {
      currentUser: null,
      overview: {},
      logs: [],
      users: [],
      configForm: {
        item_cf_weight: 0.4,
        user_cf_weight: 0.2,
        popularity_weight: 0.15,
        preference_weight: 0.25
      },
      weightFields: [
        { key: 'item_cf_weight', label: 'ItemCF 权重' },
        { key: 'user_cf_weight', label: 'UserCF 权重' },
        { key: 'popularity_weight', label: '热门度权重' },
        { key: 'preference_weight', label: '注册偏好权重' }
      ]
    }
  },
  onShow() {
    this.currentUser = getCurrentUser()
    if (this.isAdmin) {
      this.loadAll()
    }
  },
  computed: {
    isAdmin() {
      return this.currentUser && this.currentUser.role === 'admin'
    }
  },
  methods: {
    async loadAll() {
      await Promise.all([this.loadOverview(), this.loadUsers(), this.loadConfig()])
    },
    async loadOverview() {
      const res = await apiRequest('/api/admin/overview', {
        data: { admin_username: this.currentUser.username }
      })
      if (res.code === 200) {
        this.overview = res.data.stats || {}
        this.logs = res.data.recent_logs || []
      } else {
        uni.showToast({ title: res.message || '加载概览失败', icon: 'none' })
      }
    },
    async loadUsers() {
      const res = await apiRequest('/api/admin/users', {
        data: { admin_username: this.currentUser.username }
      })
      if (res.code === 200) {
        this.users = res.data || []
      }
    },
    async loadConfig() {
      const res = await apiRequest('/api/admin/recommendation-config', {
        data: { admin_username: this.currentUser.username }
      })
      if (res.code === 200) {
        this.configForm = {
          item_cf_weight: Number(res.data.item_cf_weight),
          user_cf_weight: Number(res.data.user_cf_weight),
          popularity_weight: Number(res.data.popularity_weight),
          preference_weight: Number(res.data.preference_weight)
        }
      }
    },
    handleWeightChange(key, event) {
      this.configForm[key] = Number(event.detail.value).toFixed(2)
    },
    async saveWeights() {
      const payload = {
        admin_username: this.currentUser.username,
        item_cf_weight: Number(this.configForm.item_cf_weight),
        user_cf_weight: Number(this.configForm.user_cf_weight),
        popularity_weight: Number(this.configForm.popularity_weight),
        preference_weight: Number(this.configForm.preference_weight)
      }
      const res = await apiRequest('/api/admin/recommendation-config', {
        method: 'POST',
        data: payload
      })
      uni.showToast({ title: res.message || '保存完成', icon: res.code === 200 ? 'success' : 'none' })
      if (res.code === 200) {
        this.loadOverview()
      }
    },
    async toggleStatus(user) {
      const nextStatus = user.status === 'active' ? 'banned' : 'active'
      const res = await apiRequest('/api/admin/users/status', {
        method: 'POST',
        data: {
          admin_username: this.currentUser.username,
          target_username: user.username,
          status: nextStatus
        }
      })
      uni.showToast({ title: res.message || '操作完成', icon: res.code === 200 ? 'success' : 'none' })
      if (res.code === 200) {
        this.loadAll()
      }
    },
    async toggleRole(user) {
      const nextRole = user.role === 'admin' ? 'user' : 'admin'
      const res = await apiRequest('/api/admin/users/role', {
        method: 'POST',
        data: {
          admin_username: this.currentUser.username,
          target_username: user.username,
          role: nextRole
        }
      })
      uni.showToast({ title: res.message || '操作完成', icon: res.code === 200 ? 'success' : 'none' })
      if (res.code === 200) {
        if (user.username === this.currentUser.username) {
          this.currentUser = { ...this.currentUser, role: nextRole }
          saveCurrentUser(this.currentUser)
        }
        this.loadAll()
      }
    },
    formatPreference(profile) {
      if (!profile) {
        return '未配置'
      }
      const genres = (profile.favoriteGenres || []).join(' / ') || '未配置类型'
      return `${genres}，${this.eraText(profile.preferredEra)}，${this.styleText(profile.discoveryStyle)}`
    },
    eraText(value) {
      const map = {
        classic: '经典老片',
        millennial: '千禧佳作',
        recent: '近年热门',
        all: '都可以'
      }
      return map[value] || '都可以'
    },
    styleText(value) {
      const map = {
        quality: '高口碑优先',
        balanced: '口碑热度均衡',
        trending: '热门趋势优先'
      }
      return map[value] || '口碑热度均衡'
    },
    formatTime(value) {
      if (!value) {
        return '未知'
      }
      const date = new Date(Number(value))
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    }
  }
}
</script>

<style>
.container {
  min-height: 100vh;
  padding: 24rpx;
  background: linear-gradient(180deg, #f2f6ff 0%, #f8faff 40%, #f3f6fb 100%);
}

.hero-card,
.section-card,
.empty-card {
  background: rgba(255, 255, 255, 0.94);
  border-radius: 22rpx;
  padding: 26rpx;
  box-shadow: 0 14rpx 36rpx rgba(15, 23, 42, 0.08);
}

.hero-card {
  background: linear-gradient(135deg, #111827, #2563eb);
  color: #fff;
}

.hero-title,
.section-title,
.empty-title {
  font-size: 34rpx;
  font-weight: 700;
}

.hero-subtitle,
.empty-sub {
  margin-top: 12rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.88);
}

.empty-sub {
  color: #6b7280;
}

.section-card {
  margin-top: 22rpx;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-link {
  color: #1f6fff;
  font-size: 24rpx;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16rpx;
  margin-top: 20rpx;
}

.stat-card {
  background: #f8fafc;
  border-radius: 18rpx;
  padding: 22rpx;
}

.stat-card.danger {
  background: #fff3f2;
}

.stat-card.admin {
  background: #eef4ff;
}

.stat-value {
  font-size: 42rpx;
  font-weight: 700;
  color: #111827;
}

.stat-label,
.behavior-line,
.weight-tip,
.user-meta,
.log-sub {
  margin-top: 10rpx;
  color: #6b7280;
  font-size: 23rpx;
}

.behavior-summary {
  margin-top: 22rpx;
}

.mini-title,
.weight-title,
.user-name,
.log-title {
  font-size: 27rpx;
  font-weight: 600;
  color: #111827;
}

.weight-item {
  margin-top: 22rpx;
  padding: 20rpx;
  border-radius: 18rpx;
  background: #f8fafc;
}

.weight-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.weight-input {
  width: 120rpx;
  padding: 10rpx 12rpx;
  border-radius: 12rpx;
  background: #fff;
  text-align: center;
}

.primary-btn,
.mini-btn {
  border-radius: 16rpx;
}

.primary-btn {
  margin-top: 18rpx;
  background: #1f6fff;
  color: #fff;
}

.user-row,
.log-row {
  margin-top: 18rpx;
  padding: 22rpx;
  border-radius: 18rpx;
  background: #f8fafc;
}

.user-actions {
  display: flex;
  margin-top: 16rpx;
}

.mini-btn {
  margin-right: 16rpx;
  font-size: 24rpx;
}

.mini-btn.warn {
  background: #fff5f0;
  color: #ff6b3d;
}
</style>
