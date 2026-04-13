<template>
  <view class="container" v-if="movie.id">
    <image class="poster" :src="imgUrl + movie.poster_path" mode="aspectFill" />

    <view class="title">{{ movie.chinese_name }}</view>

    <view class="meta-grid">
      <view class="meta-chip">⭐ 评分 {{ movie.vote_average }}</view>
      <view class="meta-chip">📅 {{ formatDate(movie.release_date) }}</view>
      <view class="meta-chip">🎬 {{ formatGenres(movie.genres) }}</view>
    </view>

    <view class="action-card" v-if="currentUser">
      <view class="action-title">互动操作</view>
      <view class="action-subtitle">记录你的喜好后，推荐结果会更贴近你的口味。</view>
      <view class="action-row">
        <button
          class="action-btn"
          :class="behaviorState.liked ? 'like active' : 'like'"
          :disabled="behaviorLoading.like"
          @click="toggleBehavior('like', 2.5)"
        >
          {{ behaviorLoading.like ? '处理中...' : behaviorState.liked ? '取消点赞' : '点赞' }}
        </button>
        <button
          class="action-btn"
          :class="behaviorState.favorited ? 'favorite active' : 'favorite'"
          :disabled="behaviorLoading.favorite"
          @click="toggleBehavior('favorite', 4)"
        >
          {{ behaviorLoading.favorite ? '处理中...' : behaviorState.favorited ? '取消收藏' : '收藏' }}
        </button>
      </view>
      <view v-if="actionMessage" class="action-message">{{ actionMessage }}</view>
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
      imgUrl: 'https://image.tmdb.org/t/p/w500',
      behaviorState: {
        liked: false,
        favorited: false
      },
      behaviorLoading: {
        like: false,
        favorite: false
      },
      actionMessage: ''
    }
  },
  onLoad(options) {
    this.currentUser = getCurrentUser()
    this.getDetail(options.id)
  },
  methods: {
    async getDetail(id) {
      const res = await apiRequest('/api/movie', { data: { id }, showErrorToast: true })
      if (res.code === 200) {
        this.movie = res.data || {}
        this.syncHomeSelection()
        this.recordView()
        this.fetchBehaviorState()
      }
    },
    syncHomeSelection() {
      if (!this.movie.id) {
        return
      }
      uni.setStorageSync('movie_home_last_selected_movie', {
        id: this.movie.id,
        name: this.movie.chinese_name || ''
      })
    },
    async fetchBehaviorState() {
      if (!this.currentUser || !this.movie.id) {
        return
      }

      const res = await apiRequest('/api/behavior/status', {
        data: {
          username: this.currentUser.username,
          movie_id: this.movie.id
        },
        showErrorToast: true
      })

      if (res.code === 200 && res.data) {
        this.behaviorState = {
          liked: !!res.data.liked,
          favorited: !!res.data.favorited
        }
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
    async toggleBehavior(type, score) {
      if (!this.currentUser) {
        uni.showToast({ title: '请先登录', icon: 'none' })
        return
      }

      if (this.behaviorLoading[type]) {
        return
      }

      this.behaviorLoading = {
        ...this.behaviorLoading,
        [type]: true
      }
      this.actionMessage = ''

      const res = await apiRequest('/api/behavior/toggle', {
        method: 'POST',
        data: {
          username: this.currentUser.username,
          movie_id: this.movie.id,
          behavior_type: type,
          score
        },
        showErrorToast: true
      })

      this.behaviorLoading = {
        ...this.behaviorLoading,
        [type]: false
      }

      if (res.code === 200 && res.data) {
        if (type === 'like') {
          this.behaviorState.liked = !!res.data.active
        } else if (type === 'favorite') {
          this.behaviorState.favorited = !!res.data.active
        }
        this.actionMessage = res.message || '操作成功'
        uni.showToast({ title: this.actionMessage, icon: 'success' })
        return
      }

      this.actionMessage = res.message || '操作失败，请稍后再试'
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
  background: linear-gradient(180deg, #f2f6ff 0%, #f8faff 40%, #f3f6fb 100%);
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

.action-card {
  margin-top: 24rpx;
  padding: 24rpx;
  border-radius: 24rpx;
  background: #ffffff;
  box-shadow: 0 14rpx 36rpx rgba(15, 23, 42, 0.06);
}

.action-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #111827;
}

.action-subtitle {
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #6b7280;
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
  font-weight: 600;
  border: 2rpx solid transparent;
}

.action-btn:last-child {
  margin-right: 0;
}

.action-btn[disabled] {
  opacity: 0.6;
}

.like {
  background: #eef4ff;
  color: #1f6fff;
}

.favorite {
  background: #fff5f0;
  color: #ff6b3d;
}

.like.active {
  background: #1f6fff;
  color: #fff;
  border-color: #1f6fff;
}

.favorite.active {
  background: #ff6b3d;
  color: #fff;
  border-color: #ff6b3d;
}

.action-message {
  margin-top: 18rpx;
  font-size: 24rpx;
  color: #4b5563;
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
