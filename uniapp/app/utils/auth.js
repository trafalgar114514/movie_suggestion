import { apiRequest } from '@/utils/api'

const CURRENT_USER_KEY = 'movie_current_user'
const LAST_REGISTERED_USER_KEY = 'movie_last_registered_user'
const DEFAULT_PREFERENCES = {
  favoriteGenres: [],
  preferredEra: 'all',
  discoveryStyle: 'balanced'
}

export async function registerUser(payload) {
  const result = await apiRequest('/api/auth/register', {
    method: 'POST',
    data: {
      username: payload.username,
      password: payload.password,
      nickname: payload.nickname
    }
  })

  return { ok: result.code === 200, message: result.message || '保存偏好失败' }
}

export async function saveUserPreferences(payload) {
  const result = await apiRequest('/api/auth/preferences', {
    method: 'POST',
    data: {
      username: payload.username,
      preferences: payload.preferences
    }
  })

  return { ok: result.code === 200, message: result.message || '保存偏好失败' }
}

export async function loginUser(payload) {
  const result = await apiRequest('/api/auth/login', {
    method: 'POST',
    data: {
      username: payload.username,
      password: payload.password
    }
  })

  if (result.code !== 200) {
    return { ok: false, message: result.message || '用户名或密码错误' }
  }

  const user = result.data || { username: payload.username, nickname: payload.username, role: 'user', status: 'active' }
  uni.setStorageSync(CURRENT_USER_KEY, {
    username: user.username,
    nickname: user.nickname,
    role: user.role || 'user',
    status: user.status || 'active',
    preferences: user.preferences || { ...DEFAULT_PREFERENCES }
  })

  return { ok: true, message: result.message || '登录成功', user }
}

export function getCurrentUser() {
  return uni.getStorageSync(CURRENT_USER_KEY) || null
}

export function saveCurrentUser(user) {
  uni.setStorageSync(CURRENT_USER_KEY, user)
}

export function saveLastRegisteredUser(username) {
  uni.setStorageSync(LAST_REGISTERED_USER_KEY, username)
}

export function getLastRegisteredUser() {
  return uni.getStorageSync(LAST_REGISTERED_USER_KEY) || ''
}

export function clearLastRegisteredUser() {
  uni.removeStorageSync(LAST_REGISTERED_USER_KEY)
}

export function logoutUser() {
  uni.removeStorageSync(CURRENT_USER_KEY)
}
