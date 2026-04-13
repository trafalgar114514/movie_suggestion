<template>
  <view class="auth-page">
    <view class="hero">
      <view class="hero-badge">Movie Suggestion</view>
      <view class="hero-title">登录后继续你的观影旅程</view>
      <view class="hero-subtitle">注册后即可完善偏好设置，获得更贴合口味的电影推荐。</view>
    </view>

    <view class="panel">
      <view class="tabs">
        <view class="tab" :class="{ active: mode === 'login' }" @click="mode = 'login'">登录</view>
        <view class="tab" :class="{ active: mode === 'register' }" @click="mode = 'register'">注册</view>
      </view>

      <view v-if="mode === 'login'" class="form-body">
        <view class="form-title">欢迎回来</view>
        <view class="form-tip">输入账号信息，继续查看推荐、点赞与收藏内容。</view>
        <input v-model="loginForm.username" class="input" type="text" placeholder="用户名" :cursor-spacing="24" />
        <input v-model="loginForm.password" class="input" type="text" password placeholder="密码" :cursor-spacing="24" />
        <button class="submit" @click="submitLogin">立即登录</button>
      </view>

      <view v-else class="form-body">
        <view class="form-title">创建新账号</view>
        <view class="form-tip">注册完成后会进入偏好设置页，帮助系统生成更准确的推荐。</view>
        <input v-model="registerForm.nickname" class="input" type="text" placeholder="昵称（选填）" :cursor-spacing="24" />
        <input v-model="registerForm.username" class="input" type="text" placeholder="用户名" :cursor-spacing="24" />
        <input v-model="registerForm.password" class="input" type="text" password placeholder="密码（至少6位）" :cursor-spacing="24" />
        <input v-model="registerForm.confirmPassword" class="input" type="text" password placeholder="确认密码" :cursor-spacing="24" />
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
  padding: 44rpx 28rpx;
  box-sizing: border-box;
  background: linear-gradient(180deg, #eef3ff 0%, #f8faff 45%, #ffffff 100%);
}

.hero {
  padding: 24rpx 8rpx 36rpx;
}

.hero-badge {
  display: inline-flex;
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  background: rgba(31, 111, 255, 0.08);
  color: #1f6fff;
  font-size: 22rpx;
  font-weight: 700;
}

.hero-title {
  margin-top: 24rpx;
  color: #111827;
  font-size: 46rpx;
  font-weight: 700;
  line-height: 1.3;
}

.hero-subtitle {
  margin-top: 14rpx;
  color: #667085;
  font-size: 26rpx;
  line-height: 1.6;
}

.panel {
  padding: 30rpx;
  border-radius: 30rpx;
  background: #fff;
  box-shadow: 0 18rpx 52rpx rgba(15, 23, 42, 0.08);
}

.tabs {
  display: flex;
  background: #f3f6fb;
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
  margin-top: 30rpx;
}

.form-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #111827;
}

.form-tip {
  margin-top: 10rpx;
  margin-bottom: 22rpx;
  font-size: 24rpx;
  color: #6b7280;
  line-height: 1.6;
}

.input {
  width: 100%;
  height: 96rpx;
  box-sizing: border-box;
  background: linear-gradient(180deg, #f2f6ff 0%, #f8faff 40%, #f3f6fb 100%);
  border-radius: 18rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  color: #111827;
  margin-top: 18rpx;
}

.submit {
  margin-top: 28rpx;
  border-radius: 18rpx;
  background: linear-gradient(135deg, #1f6fff, #4d8dff);
  color: #fff;
  font-size: 30rpx;
  font-weight: 600;
}
</style>
