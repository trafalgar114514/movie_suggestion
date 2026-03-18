export const API_BASE_URL = 'http://localhost:3000'

export function apiRequest(url, options = {}) {
  const { method = 'GET', data, showErrorToast = false } = options

  return new Promise((resolve) => {
    uni.request({
      url: `${API_BASE_URL}${url}`,
      method,
      data,
      success: (res) => {
        const payload = res.data || { code: 500, message: '服务异常' }
        if (showErrorToast && payload.code !== 200) {
          uni.showToast({ title: payload.message || '请求失败', icon: 'none' })
        }
        resolve(payload)
      },
      fail: () => {
        const payload = { code: 500, message: '无法连接服务器' }
        if (showErrorToast) {
          uni.showToast({ title: payload.message, icon: 'none' })
        }
        resolve(payload)
      }
    })
  })
}
