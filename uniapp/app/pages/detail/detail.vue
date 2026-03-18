<template>
  <view class="container" v-if="movie.id">
    <image class="poster" :src="imgUrl + movie.poster_path" mode="aspectFill" />

    <view class="title">{{ movie.chinese_name }}</view>

    <view class="meta-grid">
      <view class="meta-chip">⭐ 评分 {{ movie.vote_average }}</view>
      <view class="meta-chip">📅 {{ formatDate(movie.release_date) }}</view>
      <view class="meta-chip">🎬 {{ formatGenres(movie.genres) }}</view>
    </view>

    <view class="action-row" v-if="currentUser">
      <button class="action-btn like" @click="submitBehavior('like', 2.5)">点赞</button>
      <button class="action-btn favorite" @click="submitBehavior('favorite', 4)">收藏</button>
    </view>

    <view v-else class="login-tip">登录后可记录浏览、点赞与收藏，用于提升推荐效果。</view>

    <view class="info-title">简介</view>
    <view class="story">{{ movie.chinese_overview || '暂无简介' }}</view>
  </view>
</template>

<script>
import { apiRequest } from '@/utils/api'
import { getCurrentUser } from '@/utils/auth'

export default {
  data() {
    return {
      movie: {},
      currentUser: null,
      imgUrl: 'https://image.tmdb.org/t/p/w500'
    }
  },
  onLoad(options) {
    this.currentUser = getCurrentUser()
    this.getDetail(options.id)
  },
  methods: {
    async getDetail(id) {
      const res = await apiRequest('/api/movie', { data: { id } })
      if (res.code === 200) {
        this.movie = res.data || {}
        this.recordView()
      }
    },
    async recordView() {
      if (!this.currentUser || !this.movie.id) {
        return
      }
      await apiRequest('/api/behavior', {
        method: 'POST',
        data: {
          username: this.currentUser.username,
          movie_id: this.movie.id,
          behavior_type: 'view',
          score: 1
        }
      })
    },
    async submitBehavior(type, score) {
      if (!this.currentUser) {
        uni.showToast({ title: '请先登录', icon: 'none' })
        return
      }

      const res = await apiRequest('/api/behavior', {
        method: 'POST',
        data: {
          username: this.currentUser.username,
          movie_id: this.movie.id,
          behavior_type: type,
          score
        }
      })

      uni.showToast({ title: res.message || (res.code === 200 ? '操作成功' : '操作失败'), icon: res.code === 200 ? 'success' : 'none' })
    },
    formatDate(value) {
      return String(value || '').substring(0, 10) || '未知'
    },
    formatGenres(value) {
      if (!value) {
        return '暂无类型信息'
      }
      if (Array.isArray(value)) {
        return value.join(' / ')
      }
      try {
        const parsed = JSON.parse(value)
        return Array.isArray(parsed) && parsed.length ? parsed.join(' / ') : '暂无类型信息'
      } catch (error) {
        return '暂无类型信息'
      }
    }
  }
}
</script>

<style>
.container {
  padding: 24rpx;
  background: #f5f7fb;
  min-height: 100vh;
}

.poster {
  width: 100%;
  height: 720rpx;
  border-radius: 24rpx;
  background: #e5e7eb;
}

.title {
  font-size: 42rpx;
  font-weight: 700;
  margin-top: 26rpx;
  color: #111827;
}

.meta-grid {
  display: flex;
  flex-wrap: wrap;
  margin-top: 18rpx;
}

.meta-chip {
  padding: 14rpx 22rpx;
  border-radius: 999rpx;
  background: #fff;
  color: #4b5563;
  margin-right: 16rpx;
  margin-bottom: 16rpx;
  font-size: 24rpx;
}

.action-row {
  display: flex;
  margin-top: 24rpx;
}

.action-btn {
  flex: 1;
  border-radius: 18rpx;
  margin-right: 18rpx;
  font-size: 28rpx;
}

.action-btn:last-child {
  margin-right: 0;
}

.like {
  background: #eef4ff;
  color: #1f6fff;
}

.favorite {
  background: #fff5f0;
  color: #ff6b3d;
}

.login-tip {
  margin-top: 20rpx;
  padding: 22rpx;
  border-radius: 18rpx;
  background: #fff;
  color: #6b7280;
  font-size: 24rpx;
  line-height: 1.5;
}

.info-title {
  margin-top: 28rpx;
  font-size: 31rpx;
  font-weight: 700;
  color: #111827;
}

.story {
  margin-top: 18rpx;
  color: #4b5563;
  line-height: 1.8;
  font-size: 26rpx;
  background: #fff;
  padding: 24rpx;
  border-radius: 20rpx;
}
</style>
