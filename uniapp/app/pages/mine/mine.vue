<template>
  <view class="container">
    <view v-if="user" class="user-card">
      <view class="user-top">
        <view>
          <view class="greet">Hi，{{ user.nickname }}</view>
          <view class="sub">账号：{{ user.username }}</view>
          <view class="sub">身份：{{ user.role === 'admin' ? '管理员' : '普通用户' }}</view>
        </view>
        <view class="badge" :class="user.role === 'admin' ? 'admin' : 'normal'">
          {{ user.role === 'admin' ? 'ADMIN' : 'USER' }}
        </view>
      </view>

      <view class="pref-block" v-if="user.preferences">
        <view class="pref-title">注册时偏好</view>
        <view class="pref-line">喜欢类型：{{ user.preferences.favoriteGenres.join(' / ') || '未设置' }}</view>
        <view class="pref-line">年代偏好：{{ eraText(user.preferences.preferredEra) }}</view>
        <view class="pref-line">推荐风格：{{ styleText(user.preferences.discoveryStyle) }}</view>
      </view>
    </view>

    <view v-else class="empty-card">
      <view class="empty-title">还没有登录</view>
      <view class="empty-sub">登录后可获取个性推荐、记录行为并进入管理员中心。</view>
      <button class="login-btn" @click="goAuth">去登录 / 注册</button>
    </view>

    <view class="menu-card">
      <view class="menu-item" @click="goHome">查看个性推荐</view>
      <view class="menu-item" @click="goAuth">切换账号</view>
      <view v-if="user && user.role === 'admin'" class="menu-item highlight" @click="goAdmin">
        管理员中心（用户管理 / 封号 / 推荐权重）
      </view>
    </view>

    <button v-if="user" class="logout-btn" @click="logout">退出登录</button>
  </view>
</template>

<script>
import { getCurrentUser, logoutUser } from '@/utils/auth'

export default {
  data() {
    return {
      user: null
    }
  },
  onShow() {
    this.user = getCurrentUser()
  },
  methods: {
    goAuth() {
      uni.navigateTo({ url: '/pages/auth/auth' })
    },
    goHome() {
      uni.switchTab({ url: '/pages/index/index' })
    },
    goAdmin() {
      uni.navigateTo({ url: '/pages/admin/admin' })
    },
    logout() {
      logoutUser()
      this.user = null
      uni.showToast({ title: '已退出登录', icon: 'none' })
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
    }
  }
}
</script>

<style>
.container {
  padding: 24rpx;
  min-height: 100vh;
  background: #f5f7fb;
}

.user-card,
.empty-card,
.menu-card {
  background: #fff;
  border-radius: 22rpx;
  padding: 26rpx;
  box-shadow: 0 10rpx 30rpx rgba(15, 23, 42, 0.06);
}

.user-top {
  display: flex;
  justify-content: space-between;
}

.greet,
.empty-title {
  font-size: 36rpx;
  font-weight: 700;
  color: #111827;
}

.sub,
.empty-sub {
  color: #6b7280;
  margin-top: 10rpx;
  font-size: 24rpx;
}

.badge {
  height: 52rpx;
  line-height: 52rpx;
  padding: 0 18rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  font-weight: 700;
}

.badge.admin {
  background: rgba(37, 99, 235, 0.1);
  color: #2563eb;
}

.badge.normal {
  background: rgba(107, 114, 128, 0.12);
  color: #4b5563;
}

.pref-block {
  margin-top: 24rpx;
  padding: 20rpx;
  border-radius: 18rpx;
  background: #f8fafc;
}

.pref-title {
  font-size: 27rpx;
  font-weight: 600;
  color: #111827;
}

.pref-line {
  margin-top: 12rpx;
  color: #4b5563;
  font-size: 24rpx;
}

.login-btn,
.logout-btn {
  margin-top: 24rpx;
  border-radius: 16rpx;
}

.menu-card {
  margin-top: 22rpx;
}

.menu-item {
  padding: 24rpx 0;
  border-bottom: 2rpx solid #eef2f7;
  color: #111827;
  font-size: 28rpx;
}

.menu-item:last-child {
  border-bottom: 0;
}

.menu-item.highlight {
  color: #1f6fff;
  font-weight: 600;
}
</style>
