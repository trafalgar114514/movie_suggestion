<template>
  <view class="container">
    <view class="hero-card">
      <view class="hero-title">最后一步：完善你的观影偏好</view>
      <view class="hero-subtitle">设置完成后，系统会根据你的选择生成更贴合的推荐结果。</view>
    </view>

    <view class="section-card">
      <view class="question-title">1. 你最喜欢哪些电影类型？</view>
      <view class="question-tip">至少选择 1 项，最多选择 5 项</view>
      <view class="chips">
        <view
          v-for="genre in genreOptions"
          :key="genre"
          class="chip"
          :class="{ active: preferences.favoriteGenres.includes(genre) }"
          @click="toggleGenre(genre)"
        >
          {{ genre }}
        </view>
      </view>
    </view>

    <view class="section-card">
      <view class="question-title">2. 你更偏爱哪个年代的电影？</view>
      <view class="radio-list">
        <view
          v-for="item in eraOptions"
          :key="item.value"
          class="radio-item"
          :class="{ active: preferences.preferredEra === item.value }"
          @click="preferences.preferredEra = item.value"
        >
          <view class="radio-title">{{ item.label }}</view>
          <view class="radio-desc">{{ item.desc }}</view>
        </view>
      </view>
    </view>

    <view class="section-card">
      <view class="question-title">3. 你更想看到哪类推荐结果？</view>
      <view class="radio-list">
        <view
          v-for="item in styleOptions"
          :key="item.value"
          class="radio-item"
          :class="{ active: preferences.discoveryStyle === item.value }"
          @click="preferences.discoveryStyle = item.value"
        >
          <view class="radio-title">{{ item.label }}</view>
          <view class="radio-desc">{{ item.desc }}</view>
        </view>
      </view>
    </view>

    <button class="submit" @click="submitPreferences">保存偏好并返回登录</button>
    <button class="skip-btn" @click="goBackToLogin">稍后再说</button>
  </view>
</template>

<script>
import { clearLastRegisteredUser, saveLastRegisteredUser, saveUserPreferences } from '@/utils/auth'

export default {
  data() {
    return {
      username: '',
      genreOptions: ['动作', '喜剧', '爱情', '科幻', '悬疑', '动画', '犯罪', '冒险', '剧情', '惊悚'],
      eraOptions: [
        { value: 'classic', label: '经典老片', desc: '更喜欢 1999 年及以前的电影气质' },
        { value: 'millennial', label: '千禧佳作', desc: '偏爱 2000 - 2014 年的成熟商业片' },
        { value: 'recent', label: '近年热门', desc: '更关注 2015 年之后的新片' },
        { value: 'all', label: '都可以', desc: '时间不是问题，更关注内容本身' }
      ],
      styleOptions: [
        { value: 'quality', label: '高口碑优先', desc: '尽量把评分高的作品排在前面' },
        { value: 'balanced', label: '口碑热度均衡', desc: '兼顾大众热度与评分质量' },
        { value: 'trending', label: '热门趋势优先', desc: '更偏向最近热度更高的电影' }
      ],
      preferences: {
        favoriteGenres: ['剧情'],
        preferredEra: 'all',
        discoveryStyle: 'balanced'
      }
    }
  },
  onLoad(options) {
    this.username = (options && options.username) || ''
    if (this.username) {
      saveLastRegisteredUser(this.username)
    }
  },
  methods: {
    toggleGenre(genre) {
      const selected = this.preferences.favoriteGenres
      if (selected.includes(genre)) {
        this.preferences.favoriteGenres = selected.filter((item) => item !== genre)
        return
      }
      if (selected.length >= 5) {
        uni.showToast({ title: '最多选择 5 个类型', icon: 'none' })
        return
      }
      this.preferences.favoriteGenres = [...selected, genre]
    },
    async submitPreferences() {
      if (!this.username) {
        uni.showToast({ title: '缺少注册账号信息', icon: 'none' })
        return
      }

      if (!this.preferences.favoriteGenres.length) {
        uni.showToast({ title: '请至少选择一个喜欢的类型', icon: 'none' })
        return
      }

      const result = await saveUserPreferences({
        username: this.username,
        preferences: this.preferences
      })
      uni.showToast({ title: result.message, icon: result.ok ? 'success' : 'none' })
      if (result.ok) {
        clearLastRegisteredUser()
        saveLastRegisteredUser(this.username)
        setTimeout(() => {
          uni.redirectTo({ url: '/pages/auth/auth?mode=login' })
        }, 350)
      }
    },
    goBackToLogin() {
      if (this.username) {
        saveLastRegisteredUser(this.username)
      }
      uni.redirectTo({ url: '/pages/auth/auth?mode=login' })
    }
  }
}
</script>

<style>
.container {
  min-height: 100vh;
  padding: 24rpx;
  background: #f5f7fb;
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
  font-size: 38rpx;
  font-weight: 700;
}

.hero-subtitle {
  margin-top: 12rpx;
  font-size: 24rpx;
  line-height: 1.6;
  opacity: 0.92;
}

.section-card {
  margin-top: 22rpx;
}

.question-title {
  font-size: 29rpx;
  font-weight: 600;
  color: #111827;
}

.question-tip {
  margin-top: 10rpx;
  font-size: 23rpx;
  color: #6b7280;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  margin-top: 18rpx;
}

.chip {
  padding: 14rpx 22rpx;
  border-radius: 999rpx;
  background: #fff;
  color: #4b5563;
  margin-right: 16rpx;
  margin-bottom: 16rpx;
  border: 2rpx solid #e5e7eb;
}

.chip.active {
  background: #1f6fff;
  color: #fff;
  border-color: #1f6fff;
}

.radio-list {
  margin-top: 16rpx;
}

.radio-item {
  padding: 20rpx;
  border-radius: 18rpx;
  background: #fff;
  border: 2rpx solid #e5e7eb;
  margin-bottom: 14rpx;
}

.radio-item.active {
  border-color: #1f6fff;
  background: rgba(31, 111, 255, 0.06);
}

.radio-title {
  font-size: 27rpx;
  font-weight: 600;
  color: #111827;
}

.radio-desc {
  margin-top: 8rpx;
  font-size: 23rpx;
  color: #667085;
  line-height: 1.4;
}

.submit,
.skip-btn {
  margin-top: 22rpx;
  border-radius: 18rpx;
  font-size: 29rpx;
}

.submit {
  background: linear-gradient(135deg, #1f6fff, #4f8bff);
  color: #fff;
}

.skip-btn {
  background: #fff;
  color: #4b5563;
}
</style>
