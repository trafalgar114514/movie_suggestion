const CURRENT_USER_KEY = 'movie_current_user'

function requestAuth(url, data) {
  return new Promise((resolve) => {
    uni.request({
      url,
      method: 'POST',
      data,
      success: (res) => {
        resolve(res.data || { code: 500, message: '服务异常' })
      },
      fail: () => {
        resolve({ code: 500, message: '无法连接服务器' })
      }
    })
  })
}

export async function registerUser(payload) {
  const result = await requestAuth('http://localhost:3000/api/auth/register', {
    username: payload.username,
    password: payload.password,
    nickname: payload.nickname
  })

  return { ok: result.code === 200, message: result.message || '注册失败' }
}

export async function loginUser(payload) {
  const result = await requestAuth('http://localhost:3000/api/auth/login', {
    username: payload.username,
    password: payload.password
  })

  if (result.code !== 200) {
    return { ok: false, message: result.message || '用户名或密码错误' }
  }

  const user = result.data || { username: payload.username, nickname: payload.username }
  uni.setStorageSync(CURRENT_USER_KEY, {
    username: user.username,
    nickname: user.nickname
  })

  return { ok: true, message: result.message || '登录成功' }
}

export function getCurrentUser() {
  return uni.getStorageSync(CURRENT_USER_KEY) || null
}

export function logoutUser() {
  uni.removeStorageSync(CURRENT_USER_KEY)
}
