<template>
  <view class="container">
    <view class="search-card">
      <view class="search-title">电影搜索</view>
      <view class="search-subtitle">输入片名快速查看电影详情</view>
      <view class="search-row">
        <input
          v-model="keyword"
          placeholder="输入电影名，例如：盗梦空间"
          class="input"
          :cursor-spacing="24"
          confirm-type="search"
          @confirm="search"
        />
        <button class="search-btn" @click="search">搜索</button>
      </view>
    </view>

    <view v-if="list.length" class="result-card">
      <view class="result-title">搜索结果（{{ list.length }}）</view>
      <view
        v-for="item in list"
        :key="item.id"
        class="item"
        @click="goDetail(item.id)"
      >
        <view class="item-name">{{ item.chinese_name }}</view>
        <view class="item-arrow">查看详情 ›</view>
      </view>
    </view>

    <view v-else class="empty-card">
      <view class="empty-title">暂无结果</view>
      <view class="empty-subtitle">尝试输入更完整的电影名称进行搜索。</view>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      keyword: '',
      list: []
    }
  },

  methods: {
    search() {
      uni.request({
        url: 'http://localhost:3000/api/search',
        data: {
          keyword: this.keyword
        },
        success: (res) => {
          if (res.data.code === 200) {
            this.list = res.data.data
          }
        }
      })
    },

    goDetail(id) {
      uni.navigateTo({
        url: '/pages/detail/detail?id=' + id
      })
    }
  }
}
</script>

<style>
.container {
  min-height: 100vh;
  padding: 24rpx;
  background: linear-gradient(180deg, #f2f6ff 0%, #f8faff 40%, #f5f7fb 100%);
}

.search-card,
.result-card,
.empty-card {
  background: rgba(255, 255, 255, 0.94);
  border-radius: 24rpx;
  padding: 26rpx;
  box-shadow: 0 12rpx 34rpx rgba(15, 23, 42, 0.08);
}

.search-title,
.result-title,
.empty-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #111827;
}

.search-subtitle,
.empty-subtitle {
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #6b7280;
}

.search-row {
  display: flex;
  align-items: center;
  margin-top: 20rpx;
}

.input {
  flex: 1;
  height: 92rpx;
  background: #f5f7fb;
  border-radius: 16rpx;
  padding: 0 24rpx;
  font-size: 27rpx;
}

.search-btn {
  margin-left: 14rpx;
  height: 92rpx;
  line-height: 92rpx;
  padding: 0 26rpx;
  border-radius: 16rpx;
  background: linear-gradient(135deg, #1f6fff, #4f8bff);
  color: #fff;
  font-size: 27rpx;
}

.result-card,
.empty-card {
  margin-top: 22rpx;
}

.item {
  margin-top: 18rpx;
  padding: 22rpx;
  border-radius: 16rpx;
  background: linear-gradient(145deg, #f8fbff, #f4f8ff);
  border: 1rpx solid #e7edf8;
}

.item-name {
  font-size: 29rpx;
  font-weight: 600;
  color: #111827;
}

.item-arrow {
  margin-top: 8rpx;
  font-size: 23rpx;
  color: #1f6fff;
}
</style>
