export const API_BASE_URL = 'http://localhost:3000'

function buildUrl(url, method, data) {
  if (method !== 'GET' || !data || typeof data !== 'object' || Array.isArray(data)) {
    return url
  }

  const query = Object.keys(data)
    .filter((key) => data[key] !== undefined && data[key] !== null && data[key] !== '')
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
    .join('&')

  return query ? `${url}${url.includes('?') ? '&' : '?'}${query}` : url
}

export function apiRequest(url, options = {}) {
  const { method = 'GET', data, showErrorToast = false } = options
  const normalizedMethod = String(method || 'GET').toUpperCase()

  return new Promise((resolve) => {
    uni.request({
      url: `${API_BASE_URL}${buildUrl(url, normalizedMethod, data)}`,
      method: normalizedMethod,
      data: normalizedMethod === 'GET' ? undefined : data,
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
