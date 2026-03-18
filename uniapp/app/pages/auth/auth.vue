<template>
  <view class="auth-page">
    <view class="hero">
      <view class="hero-title">欢迎回来，准备挑部电影吧</view>
      <view class="hero-subtitle">登录后可获得个性推荐，注册成功后再填写偏好问卷。</view>

      <view class="buddy-stage" aria-hidden="true">
        <view
          v-for="buddy in buddies"
          :key="buddy.id"
          class="buddy"
          :class="buddy.className"
          :style="{ background: buddy.bg }"
        >
          <view class="eyes-row">
            <view v-for="eyeIndex in 2" :key="eyeIndex" class="eye">
              <view class="pupil"></view>
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
        <input v-model="loginForm.username" class="input" type="text" placeholder="用户名" :cursor-spacing="24" />
        <input v-model="loginForm.password" class="input" type="text" password placeholder="密码" :cursor-spacing="24" />
        <button class="submit" @click="submitLogin">立即登录</button>
      </view>

      <view v-else class="form-body">
        <input v-model="registerForm.nickname" class="input" type="text" placeholder="昵称（选填）" :cursor-spacing="24" />
        <input v-model="registerForm.username" class="input" type="text" placeholder="用户名" :cursor-spacing="24" />
        <input v-model="registerForm.password" class="input" type="text" password placeholder="密码（至少6位）" :cursor-spacing="24" />
        <input v-model="registerForm.confirmPassword" class="input" type="text" password placeholder="确认密码" :cursor-spacing="24" />
        <view class="register-tip">注册完成后会进入偏好设置页，帮助系统生成更准确的推荐。</view>
        <button class="submit" @click="submitRegister">创建账号</button>
      </view>
    </view>
  </view>
</template>

<script>
import { getLastRegisteredUser, loginUser, registerUser, saveLastRegisteredUser } from '@/utils/auth'

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
      loginForm: {
        username: '',
        password: ''
      },
      registerForm: {
        nickname: '',
        username: '',
        password: '',
        confirmPassword: ''
      }
    }
  },
  onLoad(options) {
    if (options && options.mode === 'login') {
      this.mode = 'login'
    }
  },
  onShow() {
    const lastRegisteredUser = getLastRegisteredUser()
    if (lastRegisteredUser) {
      this.mode = 'login'
      this.loginForm.username = lastRegisteredUser
    }
  },
  methods: {
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

      const result = await registerUser(this.registerForm)
      uni.showToast({ title: result.message, icon: result.ok ? 'success' : 'none' })
      if (result.ok) {
        saveLastRegisteredUser(this.registerForm.username)
        setTimeout(() => {
          uni.navigateTo({
            url: `/pages/preferences/preferences?username=${this.registerForm.username}`
          })
        }, 350)
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
  position: relative;
  z-index: 1;
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
  pointer-events: none;
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
  position: relative;
  z-index: 20;
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
  height: 96rpx;
  box-sizing: border-box;
  background: #f5f7fb;
  border-radius: 18rpx;
  padding: 0 24rpx;
  margin-bottom: 18rpx;
  font-size: 28rpx;
  position: relative;
  z-index: 30;
}

.register-tip {
  margin-bottom: 18rpx;
  padding: 22rpx;
  border-radius: 18rpx;
  background: #f8f9ff;
  color: #667085;
  font-size: 24rpx;
  line-height: 1.5;
}

.submit {
  margin-top: 12rpx;
  border-radius: 18rpx;
  background: linear-gradient(135deg, #1f6fff, #4f8bff);
  color: #fff;
  font-size: 30rpx;
}
</style>
