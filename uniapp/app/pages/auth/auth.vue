<template>
  <view
    class="auth-page"
    @touchstart="handleTouch"
    @touchmove="handleTouch"
    @touchend="handleRelease"
    @touchcancel="handleRelease"
    @mousemove="handleMouse"
    @mouseleave="handleRelease"
  >
    <view class="hero">
      <view class="hero-title">欢迎回来，准备挑部电影吧</view>
      <view class="hero-subtitle">登录后可获得个性推荐，管理员还能管理用户与算法</view>

      <view class="buddy-stage">
        <view
          v-for="(buddy, index) in buddies"
          :key="buddy.id"
          class="buddy"
          :class="buddy.className"
          :style="{ background: buddy.bg }"
        >
          <view class="eyes-row">
            <view v-for="eyeIndex in 2" :key="eyeIndex" class="eye">
              <view class="pupil" :style="pupilStyles[index * 2 + eyeIndex - 1]"></view>
            </view>
          </view>
          <view v-if="buddy.mouth === 'line'" class="mouth-line"></view>
          <view v-else-if="buddy.mouth === 'smile'" class="mouth-smile"></view>
          <view v-else-if="buddy.mouth === 'dot'" class="mouth-dot"></view>
        </view>
      </view>
    </view>

    <view class="panel">
      <view class="tabs">
        <view class="tab" :class="{ active: mode === 'login' }" @click="mode = 'login'">登录</view>
        <view class="tab" :class="{ active: mode === 'register' }" @click="mode = 'register'">注册</view>
      </view>

      <view v-if="mode === 'login'" class="form-body">
        <input v-model="loginForm.username" class="input" placeholder="用户名" />
        <input v-model="loginForm.password" class="input" password placeholder="密码" />
        <button class="submit" @click="submitLogin">立即登录</button>
      </view>

      <view v-else class="form-body">
        <input v-model="registerForm.nickname" class="input" placeholder="昵称（选填）" />
        <input v-model="registerForm.username" class="input" placeholder="用户名" />
        <input v-model="registerForm.password" class="input" password placeholder="密码（至少6位）" />
        <input v-model="registerForm.confirmPassword" class="input" password placeholder="确认密码" />

        <view class="question-card">
          <view class="question-title">1. 你最喜欢哪些电影类型？</view>
          <view class="question-tip">至少选择 1 项，最多建议 5 项</view>
          <view class="chips">
            <view
              v-for="genre in genreOptions"
              :key="genre"
              class="chip"
              :class="{ active: registerForm.preferences.favoriteGenres.includes(genre) }"
              @click="toggleGenre(genre)"
            >
              {{ genre }}
            </view>
          </view>
        </view>

        <view class="question-card">
          <view class="question-title">2. 你更偏爱哪个年代的电影？</view>
          <view class="radio-list">
            <view
              v-for="item in eraOptions"
              :key="item.value"
              class="radio-item"
              :class="{ active: registerForm.preferences.preferredEra === item.value }"
              @click="registerForm.preferences.preferredEra = item.value"
            >
              <view class="radio-title">{{ item.label }}</view>
              <view class="radio-desc">{{ item.desc }}</view>
            </view>
          </view>
        </view>

        <view class="question-card">
          <view class="question-title">3. 你更想看到哪类推荐结果？</view>
          <view class="radio-list">
            <view
              v-for="item in styleOptions"
              :key="item.value"
              class="radio-item"
              :class="{ active: registerForm.preferences.discoveryStyle === item.value }"
              @click="registerForm.preferences.discoveryStyle = item.value"
            >
              <view class="radio-title">{{ item.label }}</view>
              <view class="radio-desc">{{ item.desc }}</view>
            </view>
          </view>
        </view>

        <button class="submit" @click="submitRegister">创建账号</button>
      </view>
    </view>
  </view>
</template>

<script>
import { loginUser, registerUser } from '@/utils/auth'

const CENTER_TRANSFORM = 'translate(0px, 0px)'

export default {
  data() {
    return {
      mode: 'login',
      buddies: [
        { id: 1, className: 'buddy-back-left', bg: 'linear-gradient(180deg, #6a59ff, #5544e7)', mouth: 'dot' },
        { id: 2, className: 'buddy-back-mid', bg: 'linear-gradient(180deg, #2f3040, #232431)', mouth: 'dot' },
        { id: 3, className: 'buddy-front-left', bg: 'linear-gradient(180deg, #ffa26f, #f18d61)', mouth: 'smile' },
        { id: 4, className: 'buddy-front-right', bg: 'linear-gradient(180deg, #e8dc5e, #dfcf4f)', mouth: 'line' }
      ],
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
      loginForm: {
        username: '',
        password: ''
      },
      registerForm: {
        nickname: '',
        username: '',
        password: '',
        confirmPassword: '',
        preferences: {
          favoriteGenres: ['剧情'],
          preferredEra: 'all',
          discoveryStyle: 'balanced'
        }
      },
      eyeCenters: [],
      pupilStyles: Array.from({ length: 8 }, () => ({ transform: CENTER_TRANSFORM }))
    }
  },
  mounted() {
    this.$nextTick(() => {
      this.captureEyeCenters()
    })
  },
  methods: {
    captureEyeCenters() {
      const query = uni.createSelectorQuery().in(this)
      query.selectAll('.eye').boundingClientRect()
      query.exec((res) => {
        const list = res[0] || []
        this.eyeCenters = list.map((item) => ({
          x: item.left + item.width / 2,
          y: item.top + item.height / 2
        }))
      })
    },
    resetPupils() {
      this.pupilStyles = this.pupilStyles.map(() => ({ transform: CENTER_TRANSFORM }))
    },
    updatePupils(clientX, clientY) {
      if (!this.eyeCenters.length) {
        return
      }

      const max = 7
      this.pupilStyles = this.eyeCenters.map((eye) => {
        const dx = clientX - eye.x
        const dy = clientY - eye.y
        const distance = Math.sqrt(dx * dx + dy * dy) || 1
        const ratio = Math.min(max, distance) / distance
        return {
          transform: `translate(${(dx * ratio).toFixed(2)}px, ${(dy * ratio).toFixed(2)}px)`
        }
      })
    },
    handleTouch(event) {
      const touch = event.touches && event.touches[0]
      if (touch) {
        this.updatePupils(touch.clientX, touch.clientY)
      }
    },
    handleRelease() {
      this.resetPupils()
    },
    handleMouse(event) {
      // #ifdef H5
      this.updatePupils(event.clientX, event.clientY)
      // #endif
    },
    toggleGenre(genre) {
      const selected = this.registerForm.preferences.favoriteGenres
      if (selected.includes(genre)) {
        this.registerForm.preferences.favoriteGenres = selected.filter((item) => item !== genre)
        return
      }
      if (selected.length >= 5) {
        uni.showToast({ title: '最多选择 5 个类型', icon: 'none' })
        return
      }
      this.registerForm.preferences.favoriteGenres = [...selected, genre]
    },
    async submitLogin() {
      if (!this.loginForm.username || !this.loginForm.password) {
        uni.showToast({ title: '请完整填写登录信息', icon: 'none' })
        return
      }

      const result = await loginUser(this.loginForm)
      uni.showToast({ title: result.message, icon: result.ok ? 'success' : 'none' })

      if (result.ok) {
        setTimeout(() => {
          uni.switchTab({ url: '/pages/mine/mine' })
        }, 400)
      }
    },
    async submitRegister() {
      if (!this.registerForm.username || !this.registerForm.password) {
        uni.showToast({ title: '请填写用户名和密码', icon: 'none' })
        return
      }

      if (this.registerForm.password.length < 6) {
        uni.showToast({ title: '密码至少6位', icon: 'none' })
        return
      }

      if (this.registerForm.password !== this.registerForm.confirmPassword) {
        uni.showToast({ title: '两次输入的密码不一致', icon: 'none' })
        return
      }

      if (!this.registerForm.preferences.favoriteGenres.length) {
        uni.showToast({ title: '请至少选择一个喜欢的类型', icon: 'none' })
        return
      }

      const result = await registerUser(this.registerForm)
      uni.showToast({ title: result.message, icon: result.ok ? 'success' : 'none' })
      if (result.ok) {
        this.mode = 'login'
        this.loginForm.username = this.registerForm.username
        this.loginForm.password = ''
      }
    }
  }
}
</script>

<style>
.auth-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #616d84 0%, #7c879d 38%, #f5f6fb 38%, #f5f6fb 100%);
}

.hero {
  padding: 42rpx 30rpx 20rpx;
}

.hero-title {
  color: #fff;
  font-size: 42rpx;
  font-weight: 700;
}

.hero-subtitle {
  margin-top: 10rpx;
  color: rgba(255, 255, 255, 0.86);
  font-size: 25rpx;
  line-height: 1.5;
}

.buddy-stage {
  height: 430rpx;
  margin-top: 30rpx;
  border-radius: 34rpx;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.03));
  position: relative;
  overflow: hidden;
}

.buddy {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 56rpx;
  box-shadow: 0 14rpx 30rpx rgba(30, 36, 60, 0.2);
}

.buddy-back-left {
  width: 180rpx;
  height: 290rpx;
  left: 170rpx;
  bottom: 0;
  border-radius: 26rpx 26rpx 0 0;
}

.buddy-back-mid {
  width: 150rpx;
  height: 236rpx;
  left: 300rpx;
  bottom: 0;
  border-radius: 20rpx 20rpx 0 0;
}

.buddy-front-left {
  width: 290rpx;
  height: 200rpx;
  left: 50rpx;
  bottom: 0;
  border-radius: 150rpx 150rpx 0 0;
  z-index: 2;
}

.buddy-front-right {
  width: 170rpx;
  height: 250rpx;
  right: 54rpx;
  bottom: 0;
  border-radius: 88rpx 88rpx 0 0;
  z-index: 2;
}

.eyes-row {
  display: flex;
}

.eye {
  width: 30rpx;
  height: 30rpx;
  margin: 0 16rpx;
  border-radius: 50%;
  background: #fff;
  position: relative;
  overflow: hidden;
}

.pupil {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  background: #20212a;
  position: absolute;
  left: 8rpx;
  top: 8rpx;
  transition: transform 0.08s linear;
}

.mouth-line,
.mouth-dot,
.mouth-smile {
  margin-top: 28rpx;
}

.mouth-line {
  width: 48rpx;
  height: 8rpx;
  border-radius: 999rpx;
  background: rgba(35, 36, 49, 0.85);
}

.mouth-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: rgba(35, 36, 49, 0.85);
}

.mouth-smile {
  width: 54rpx;
  height: 28rpx;
  border: 6rpx solid rgba(35, 36, 49, 0.85);
  border-top: 0;
  border-left-color: transparent;
  border-right-color: transparent;
  border-bottom-left-radius: 40rpx;
  border-bottom-right-radius: 40rpx;
}

.panel {
  margin: -30rpx 24rpx 30rpx;
  padding: 28rpx;
  border-radius: 30rpx;
  background: #fff;
  box-shadow: 0 16rpx 46rpx rgba(55, 68, 100, 0.12);
}

.tabs {
  display: flex;
  background: #f1f3fb;
  border-radius: 20rpx;
  padding: 8rpx;
}

.tab {
  flex: 1;
  text-align: center;
  padding: 18rpx 0;
  border-radius: 16rpx;
  color: #667085;
  font-size: 28rpx;
}

.tab.active {
  background: #fff;
  color: #1f2937;
  font-weight: 600;
  box-shadow: 0 8rpx 20rpx rgba(29, 41, 57, 0.08);
}

.form-body {
  margin-top: 26rpx;
}

.input {
  width: 100%;
  box-sizing: border-box;
  background: #f5f7fb;
  border-radius: 18rpx;
  padding: 24rpx;
  margin-bottom: 18rpx;
  font-size: 28rpx;
}

.question-card {
  background: #f8f9ff;
  border-radius: 22rpx;
  padding: 22rpx;
  margin-bottom: 18rpx;
}

.question-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #1f2937;
}

.question-tip {
  margin-top: 10rpx;
  font-size: 23rpx;
  color: #667085;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  margin-top: 16rpx;
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

.submit {
  margin-top: 12rpx;
  border-radius: 18rpx;
  background: linear-gradient(135deg, #1f6fff, #4f8bff);
  color: #fff;
  font-size: 30rpx;
}
</style>
