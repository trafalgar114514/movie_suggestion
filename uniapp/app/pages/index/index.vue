<template>
  <view class="container">
    <view class="hero-card">
      <view>
        <view class="hero-title">智能电影推荐</view>
        <view class="hero-subtitle">
          {{ currentUser ? `根据 ${currentUser.nickname} 的偏好与行为实时推荐` : '登录后可获得专属推荐，未登录时展示热门影片' }}
        </view>
      </view>
      <view class="hero-actions">
        <view class="search" @click="goSearch">🔍 搜索电影</view>
      </view>
    </view>

    <view class="section-card">
      <view class="section-header">
        <view>
          <view class="section-title">为你推荐</view>
          <view class="section-subtitle">{{ recommendMetaLabel }}</view>
        </view>
        <view class="section-link" @click="refreshRecommendations">刷新</view>
      </view>

      <view v-if="recommendations.length" class="recommend-list">
        <scroll-view scroll-x class="recommend-scroll" show-scrollbar="false">
          <view class="recommend-track">
            <view
              v-for="item in recommendations"
              :key="item.id"
              class="recommend-card"
              @click="goDetail(item.id)"
            >
              <image class="recommend-poster" :src="imgUrl + item.poster_path" mode="aspectFill" />
              <view class="recommend-name">{{ item.chinese_name }}</view>
              <view class="recommend-meta">匹配度 {{ formatScore(item.recommendation_score) }}</view>
              <view class="recommend-meta">⭐ {{ item.vote_average }}</view>
            </view>
          </view>
        </scroll-view>
      </view>

      <view v-else class="empty-state">
        <view class="empty-title">暂时还没有推荐结果</view>
        <view class="empty-subtitle">登录并完成浏览、点赞或收藏后，推荐会越来越准。</view>
      </view>
    </view>

    <view class="section-card">
      <view class="section-header">
        <view>
          <view class="section-title">热门影片</view>
          <view class="section-subtitle">当前系统热门电影列表</view>
        </view>
      </view>

      <view
        v-for="item in movies"
        :key="item.id"
        class="movie-card"
        @click="goDetail(item.id)"
      >
        <image class="poster" :src="imgUrl + item.poster_path" mode="aspectFill" />

        <view class="right">
          <view class="title">{{ item.chinese_name }}</view>
          <view class="info">⭐评分：{{ item.vote_average }}</view>
          <view class="info">📅上映：{{ formatDate(item.release_date) }}</view>
          <view class="genres">{{ formatGenres(item.genres) }}</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { apiRequest } from '@/utils/api'
import { getCurrentUser } from '@/utils/auth'

export default {
  data() {
    return {
      currentUser: null,
      recommendations: [],
      recommendMode: 'guest',
      movies: [],
      imgUrl: 'https://image.tmdb.org/t/p/w500'
    }
  },
  onShow() {
    this.currentUser = getCurrentUser()
    this.getMovies()
    this.getRecommendations()
  },
  computed: {
    recommendMetaLabel() {
      if (this.recommendMode === 'hybrid') {
        return '融合偏好、观影行为、相似用户与热门度'
      }
      if (this.recommendMode === 'preference-cold-start') {
        return '根据注册时选择的偏好冷启动推荐'
      }
      return '未登录时展示热门与高分兼顾的内容'
    }
  },
  methods: {
    async getMovies() {
      const res = await apiRequest('/api/movies')
      if (res.code === 200) {
        this.movies = res.data || []
      }
    },
    async getRecommendations() {
      const query = this.currentUser ? `?username=${this.currentUser.username}&limit=8` : '?limit=8'
      const res = await apiRequest(`/api/recommend${query}`)
      if (res.code === 200) {
        this.recommendations = res.data || []
        this.recommendMode = (res.meta && res.meta.mode) || 'guest'
      } else {
        this.recommendations = []
      }
    },
    refreshRecommendations() {
      this.getRecommendations()
    },
    goSearch() {
      uni.navigateTo({ url: '/pages/search/search' })
    },
    goDetail(id) {
      uni.navigateTo({ url: `/pages/detail/detail?id=${id}` })
    },
    formatDate(value) {
      return String(value || '').substring(0, 10) || '未知'
    },
    formatScore(value) {
      return `${Math.round((Number(value) || 0) * 100)}%`
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

.hero-card,
.section-card {
  background: #fff;
  border-radius: 24rpx;
  padding: 26rpx;
  box-shadow: 0 12rpx 32rpx rgba(15, 23, 42, 0.06);
}

.hero-card {
  background: linear-gradient(135deg, #1f6fff, #5e94ff);
  color: #fff;
}

.hero-title {
  font-size: 40rpx;
  font-weight: 700;
}

.hero-subtitle {
  margin-top: 12rpx;
  font-size: 25rpx;
  opacity: 0.9;
  line-height: 1.5;
}

.hero-actions {
  margin-top: 24rpx;
}

.search {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 18rpx 28rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.18);
  font-size: 26rpx;
}

.section-card {
  margin-top: 22rpx;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  font-size: 33rpx;
  font-weight: 700;
  color: #111827;
}

.section-subtitle {
  margin-top: 8rpx;
  font-size: 23rpx;
  color: #6b7280;
}

.section-link {
  color: #1f6fff;
  font-size: 24rpx;
}

.recommend-list {
  margin-top: 22rpx;
}

.recommend-scroll {
  white-space: nowrap;
}

.recommend-track {
  display: inline-flex;
}

.recommend-card {
  width: 220rpx;
  margin-right: 20rpx;
}

.recommend-poster {
  width: 220rpx;
  height: 300rpx;
  border-radius: 18rpx;
  background: #eef2ff;
}

.recommend-name {
  margin-top: 14rpx;
  font-size: 27rpx;
  color: #111827;
  font-weight: 600;
  white-space: normal;
}

.recommend-meta {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #6b7280;
}

.empty-state {
  margin-top: 20rpx;
  padding: 24rpx;
  border-radius: 18rpx;
  background: #f8fafc;
}

.empty-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #111827;
}

.empty-subtitle {
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #6b7280;
}

.movie-card {
  display: flex;
  background: #f8fafc;
  margin-top: 20rpx;
  padding: 20rpx;
  border-radius: 20rpx;
}

.poster {
  width: 160rpx;
  height: 220rpx;
  border-radius: 14rpx;
  background: #e5e7eb;
}

.right {
  margin-left: 20rpx;
  flex: 1;
}

.title {
  font-size: 32rpx;
  font-weight: bold;
  color: #111827;
}

.info {
  margin-top: 12rpx;
  color: #4b5563;
  font-size: 25rpx;
}

.genres {
  margin-top: 14rpx;
  color: #6b7280;
  font-size: 23rpx;
  line-height: 1.5;
}
</style>
