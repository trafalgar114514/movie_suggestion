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
        <view class="pref-header">
          <view class="pref-title">当前偏好</view>
          <view class="pref-edit" @click="goPreferences">编辑偏好</view>
        </view>
        <view class="pref-line">喜欢类型：{{ favoriteGenresText }}</view>
        <view class="pref-line">年代偏好：{{ eraText(user.preferences.preferredEra) }}</view>
        <view class="pref-line">推荐风格：{{ styleText(user.preferences.discoveryStyle) }}</view>
      </view>
    </view>

    <view v-else class="empty-card">
      <view class="empty-title">还没有登录</view>
      <view class="empty-sub">登录后可获取个性推荐、记录行为并进入管理员中心。</view>
      <button class="login-btn" @click="goAuth">去登录 / 注册</button>
    </view>

    <view v-if="user" class="section-card">
      <view class="section-head">
        <view>
          <view class="section-title">我的点赞</view>
          <view class="section-sub">展示你点赞过的电影内容</view>
        </view>
        <view class="section-count">{{ likedMovies.length }}</view>
      </view>
      <view v-if="likedMovies.length">
        <view v-for="item in likedMovies" :key="`like-${item.id}`" class="movie-item" @click="goDetail(item.id)">
          <image class="movie-poster" :src="imgUrl + item.poster_path" mode="aspectFill" />
          <view class="movie-body">
            <view class="movie-name">{{ item.chinese_name }}</view>
            <view class="movie-meta">⭐ {{ item.vote_average || '暂无' }} · {{ formatDate(item.release_date) }}</view>
            <view class="movie-tag like-tag">已点赞</view>
          </view>
        </view>
      </view>
      <view v-else class="section-empty">还没有点赞内容，去详情页点个赞吧。</view>
    </view>

    <view v-if="user" class="section-card">
      <view class="section-head">
        <view>
          <view class="section-title">我的收藏</view>
          <view class="section-sub">展示你收藏过的电影内容</view>
        </view>
        <view class="section-count">{{ favoriteMovies.length }}</view>
      </view>
      <view v-if="favoriteMovies.length">
        <view v-for="item in favoriteMovies" :key="`favorite-${item.id}`" class="movie-item" @click="goDetail(item.id)">
          <image class="movie-poster" :src="imgUrl + item.poster_path" mode="aspectFill" />
          <view class="movie-body">
            <view class="movie-name">{{ item.chinese_name }}</view>
            <view class="movie-meta">⭐ {{ item.vote_average || '暂无' }} · {{ formatDate(item.release_date) }}</view>
            <view class="movie-tag favorite-tag">已收藏</view>
          </view>
        </view>
      </view>
      <view v-else class="section-empty">还没有收藏内容，遇到喜欢的电影记得先收藏。</view>
    </view>

    <view class="menu-card">
      <view class="menu-item" @click="goHome">查看个性推荐</view>
      <view v-if="user" class="menu-item" @click="goPreferences">修改推荐偏好</view>
      <view class="menu-item" @click="goAuth">切换账号</view>
      <view v-if="user && user.role === 'admin'" class="menu-item highlight" @click="goAdmin">
        管理员中心（用户管理 / 封号 / 推荐权重）
      </view>
    </view>

    <button v-if="user" class="logout-btn" @click="logout">退出登录</button>
  </view>
</template>

<script>
import { apiRequest } from '@/utils/api'
import { getCurrentUser, logoutUser } from '@/utils/auth'

export default {
  data() {
    return {
      user: null,
      likedMovies: [],
      favoriteMovies: [],
      imgUrl: 'https://image.tmdb.org/t/p/w500'
    }
  },
  onShow() {
    this.user = getCurrentUser()
    if (this.user) {
      this.fetchCollections()
      return
    }
    this.likedMovies = []
    this.favoriteMovies = []
  },
  computed: {
    favoriteGenresText() {
      return (((this.user || {}).preferences || {}).favoriteGenres || []).join(' / ') || '未设置'
    }
  },
  methods: {
    async fetchCollections() {
      const res = await apiRequest('/api/user/collections', {
        data: {
          username: this.user.username
        },
        showErrorToast: true
      })

      if (res.code === 200 && res.data) {
        this.likedMovies = res.data.liked || []
        this.favoriteMovies = res.data.favorited || []
      }
    },
    goAuth() {
      uni.navigateTo({ url: '/pages/auth/auth' })
    },
    goHome() {
      uni.switchTab({ url: '/pages/index/index' })
    },
    goPreferences() {
      if (!this.user) {
        uni.showToast({ title: '请先登录', icon: 'none' })
        return
      }
      uni.navigateTo({ url: `/pages/preferences/preferences?username=${this.user.username}&source=mine` })
    },
    goAdmin() {
      uni.navigateTo({ url: '/pages/admin/admin' })
    },
    goDetail(id) {
      uni.navigateTo({ url: `/pages/detail/detail?id=${id}` })
    },
    logout() {
      logoutUser()
      this.user = null
      this.likedMovies = []
      this.favoriteMovies = []
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
    },
    formatDate(value) {
      return String(value || '').substring(0, 10) || '未知日期'
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
.menu-card,
.section-card {
  background: #fff;
  border-radius: 22rpx;
  padding: 26rpx;
  box-shadow: 0 10rpx 30rpx rgba(15, 23, 42, 0.06);
}

.user-top,
.section-head,
.pref-header {
  display: flex;
  justify-content: space-between;
}

.greet,
.empty-title,
.section-title {
  font-size: 36rpx;
  font-weight: 700;
  color: #111827;
}

.sub,
.empty-sub,
.section-sub {
  color: #6b7280;
  margin-top: 10rpx;
  font-size: 24rpx;
}

.badge,
.section-count {
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

.badge.normal,
.section-count {
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

.pref-edit {
  color: #1f6fff;
  font-size: 24rpx;
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

.section-card,
.menu-card {
  margin-top: 22rpx;
}

.movie-item {
  display: flex;
  align-items: center;
  margin-top: 22rpx;
  padding: 18rpx;
  border-radius: 18rpx;
  background: #f8fafc;
}

.movie-poster {
  width: 132rpx;
  height: 176rpx;
  border-radius: 16rpx;
  background: #e5e7eb;
  flex-shrink: 0;
}

.movie-body {
  margin-left: 20rpx;
  flex: 1;
}

.movie-name {
  font-size: 28rpx;
  font-weight: 600;
  color: #111827;
}

.movie-meta {
  margin-top: 12rpx;
  font-size: 23rpx;
  color: #6b7280;
}

.movie-tag {
  display: inline-flex;
  margin-top: 16rpx;
  padding: 8rpx 18rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  font-weight: 600;
}

.like-tag {
  background: #eef4ff;
  color: #1f6fff;
}

.favorite-tag {
  background: #fff2ec;
  color: #ff6b3d;
}

.section-empty {
  margin-top: 22rpx;
  padding: 24rpx;
  border-radius: 18rpx;
  background: #f8fafc;
  color: #6b7280;
  font-size: 24rpx;
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
