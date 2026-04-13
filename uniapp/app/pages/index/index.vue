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
        <view class="section-link" :class="{ disabled: recommendLoading }" @click="refreshRecommendations">
          {{ recommendLoading ? '刷新中...' : '刷新' }}
        </view>
      </view>

      <view v-if="selectedRecommendationName" class="resume-tip">
        刚刚浏览：{{ selectedRecommendationName }}。返回首页后已保留原推荐列表，避免你找不到它。
      </view>

      <view v-if="recommendations.length" class="recommend-list">
        <scroll-view scroll-x class="recommend-scroll" :scroll-into-view="activeRecommendAnchor" show-scrollbar="false">
          <view class="recommend-track">
            <view
              v-for="item in recommendations"
              :id="recommendAnchorId(item.id)"
              :key="item.id"
              class="recommend-card"
              :class="{ active: selectedRecommendationId === item.id }"
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

      <view v-else-if="recommendLoading" class="empty-state">
        <view class="empty-title">正在加载推荐结果...</view>
        <view class="empty-subtitle">请稍候，系统正在整理更适合你的电影。</view>
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

const HOME_RECOMMENDATION_CACHE_KEY = 'movie_home_recommendation_cache'
const HOME_RECOMMENDATION_CACHE_TTL = 5 * 60 * 1000
const HOME_LAST_SELECTED_MOVIE_KEY = 'movie_home_last_selected_movie'

export default {
  data() {
    return {
      currentUser: null,
      recommendations: [],
      recommendMode: 'guest',
      movies: [],
      imgUrl: 'https://image.tmdb.org/t/p/w500',
      recommendLoading: false,
      selectedRecommendationId: null,
      selectedRecommendationName: ''
    }
  },
  onShow() {
    const nextUser = getCurrentUser()
    const userChanged = !this.isSameUser(this.currentUser, nextUser)
    this.currentUser = nextUser
    this.restoreSelectedRecommendation()
    this.getMovies()

    if (userChanged) {
      this.getRecommendations({ force: true })
      return
    }

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
    },
    activeRecommendAnchor() {
      return this.selectedRecommendationId ? this.recommendAnchorId(this.selectedRecommendationId) : ''
    }
  },
  methods: {
    isSameUser(leftUser, rightUser) {
      return ((leftUser || {}).username || '') === ((rightUser || {}).username || '')
    },
    getCacheKey() {
      const username = (this.currentUser && this.currentUser.username) || 'guest'
      return `${HOME_RECOMMENDATION_CACHE_KEY}_${username}`
    },
    readRecommendationCache() {
      return uni.getStorageSync(this.getCacheKey()) || null
    },
    writeRecommendationCache(payload) {
      uni.setStorageSync(this.getCacheKey(), {
        ...payload,
        savedAt: Date.now()
      })
    },
    restoreSelectedRecommendation() {
      const lastSelection = uni.getStorageSync(HOME_LAST_SELECTED_MOVIE_KEY) || null
      if (!lastSelection) {
        this.selectedRecommendationId = null
        this.selectedRecommendationName = ''
        return
      }
      this.selectedRecommendationId = Number(lastSelection.id) || null
      this.selectedRecommendationName = lastSelection.name || ''
    },
    async getMovies() {
      const res = await apiRequest('/api/movies', { showErrorToast: true })
      if (res.code === 200) {
        this.movies = res.data || []
      }
    },
    async getRecommendations(options = {}) {
      const { force = false } = options
      const cached = this.readRecommendationCache()
      const hasValidCache = cached && Date.now() - Number(cached.savedAt || 0) < HOME_RECOMMENDATION_CACHE_TTL

      if (!force && hasValidCache && Array.isArray(cached.items) && cached.items.length) {
        this.recommendations = cached.items
        this.recommendMode = cached.mode || 'guest'
        return
      }

      if (this.recommendLoading) {
        return
      }

      this.recommendLoading = true
      const query = this.currentUser ? `?username=${this.currentUser.username}&limit=8` : '?limit=8'
      const res = await apiRequest(`/api/recommend${query}`, { showErrorToast: true })
      this.recommendLoading = false

      if (res.code === 200) {
        this.recommendations = res.data || []
        this.recommendMode = (res.meta && res.meta.mode) || 'guest'
        this.writeRecommendationCache({
          items: this.recommendations,
          mode: this.recommendMode
        })
        return
      }

      if (!hasValidCache) {
        this.recommendations = []
      }
    },
    refreshRecommendations() {
      if (this.recommendLoading) {
        return
      }
      this.getRecommendations({ force: true })
    },
    recommendAnchorId(id) {
      return `recommend-${id}`
    },
    goSearch() {
      uni.navigateTo({ url: '/pages/search/search' })
    },
    goDetail(id) {
      const currentMovie = this.recommendations.find((item) => item.id === id)
      if (currentMovie) {
        uni.setStorageSync(HOME_LAST_SELECTED_MOVIE_KEY, {
          id,
          name: currentMovie.chinese_name
        })
      }
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
  background: linear-gradient(180deg, #f2f6ff 0%, #f7f9fc 35%, #f3f6fb 100%);
  min-height: 100vh;
}

.hero-card,
.section-card {
  background: rgba(255, 255, 255, 0.92);
  border-radius: 26rpx;
  padding: 26rpx;
  box-shadow: 0 14rpx 36rpx rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(8rpx);
}

.hero-card {
  background: linear-gradient(135deg, #1e5eff, #6a9bff);
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
  background: rgba(255, 255, 255, 0.2);
  border: 1rpx solid rgba(255, 255, 255, 0.3);
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

.section-link.disabled {
  opacity: 0.45;
}

.resume-tip {
  margin-top: 20rpx;
  padding: 20rpx 22rpx;
  border-radius: 18rpx;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 24rpx;
  line-height: 1.5;
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
  border-radius: 22rpx;
  padding: 8rpx;
  transition: all 0.2s ease;
}

.recommend-card.active {
  background: rgba(31, 111, 255, 0.08);
  box-shadow: inset 0 0 0 2rpx rgba(31, 111, 255, 0.16);
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
  background: linear-gradient(145deg, #f8fbff, #f4f7fb);
  margin-top: 20rpx;
  padding: 20rpx;
  border-radius: 20rpx;
  border: 1rpx solid #e7edf8;
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
