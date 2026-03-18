const express = require('express')
const mysql = require('mysql2')
const cors = require('cors')
const crypto = require('crypto')

const app = express()
app.use(cors())
app.use(express.json())

const HASH_ITERATIONS = 120000
const HASH_KEY_LENGTH = 64
const HASH_DIGEST = 'sha512'
const GENRE_OPTIONS = ['动作', '喜剧', '爱情', '科幻', '悬疑', '动画', '犯罪', '冒险', '剧情', '惊悚']
const ERA_OPTIONS = new Set(['classic', 'millennial', 'recent', 'all'])
const STYLE_OPTIONS = new Set(['quality', 'balanced', 'trending'])
const USER_STATUS = new Set(['active', 'banned'])
const USER_ROLES = new Set(['user', 'admin'])
const DEFAULT_RECOMMENDATION_WEIGHTS = {
  item_cf_weight: 0.4,
  user_cf_weight: 0.2,
  popularity_weight: 0.15,
  preference_weight: 0.25
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, HASH_ITERATIONS, HASH_KEY_LENGTH, HASH_DIGEST).toString('hex')
}

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '123123lzy',
  database: 'movie_db'
})

const query = (sql, params = []) => db.promise().query(sql, params).then(([rows]) => rows)

async function ensureColumn(tableName, definition, duplicateKeyName = 'ER_DUP_FIELDNAME') {
  try {
    await query(`ALTER TABLE ${tableName} ADD COLUMN ${definition}`)
  } catch (error) {
    if (error.code !== duplicateKeyName) {
      console.log(`初始化${tableName}字段失败:`, error)
    }
  }
}

async function initUserTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS users (
      id INT PRIMARY KEY AUTO_INCREMENT,
      username VARCHAR(50) NOT NULL UNIQUE,
      nickname VARCHAR(50) NOT NULL,
      password_hash VARCHAR(128) NOT NULL,
      password_salt VARCHAR(32) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'user',
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      preference_profile JSON NULL,
      created_at BIGINT NOT NULL,
      INDEX idx_role_status (role, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `

  await query(sql)
  await ensureColumn('users', "role VARCHAR(20) NOT NULL DEFAULT 'user'")
  await ensureColumn('users', "status VARCHAR(20) NOT NULL DEFAULT 'active'")
  await ensureColumn('users', 'preference_profile JSON NULL')
}

async function initMovieExtensionSchema() {
  await ensureColumn('movies', 'genres JSON NULL')

  const createBehaviorSql = `
    CREATE TABLE IF NOT EXISTS user_movie_behaviors (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      username VARCHAR(50) NOT NULL,
      movie_id INT NOT NULL,
      behavior_type ENUM('view', 'like', 'favorite') NOT NULL,
      score DECIMAL(5,2) NOT NULL DEFAULT 1,
      created_at BIGINT NOT NULL,
      INDEX idx_user_movie (username, movie_id),
      INDEX idx_movie (movie_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `

  await query(createBehaviorSql)

  const createConfigSql = `
    CREATE TABLE IF NOT EXISTS recommendation_configs (
      id TINYINT PRIMARY KEY,
      item_cf_weight DECIMAL(6,4) NOT NULL,
      user_cf_weight DECIMAL(6,4) NOT NULL,
      popularity_weight DECIMAL(6,4) NOT NULL,
      preference_weight DECIMAL(6,4) NOT NULL,
      updated_at BIGINT NOT NULL,
      updated_by VARCHAR(50) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `

  await query(createConfigSql)

  const createAuditSql = `
    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      admin_username VARCHAR(50) NOT NULL,
      action_type VARCHAR(50) NOT NULL,
      target_username VARCHAR(50) NULL,
      action_detail JSON NULL,
      created_at BIGINT NOT NULL,
      INDEX idx_admin_created (admin_username, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `

  await query(createAuditSql)

  const configRows = await query('SELECT id FROM recommendation_configs WHERE id = 1 LIMIT 1')
  if (!configRows.length) {
    await query(
      `
        INSERT INTO recommendation_configs
        (id, item_cf_weight, user_cf_weight, popularity_weight, preference_weight, updated_at, updated_by)
        VALUES (1, ?, ?, ?, ?, ?, ?)
      `,
      [
        DEFAULT_RECOMMENDATION_WEIGHTS.item_cf_weight,
        DEFAULT_RECOMMENDATION_WEIGHTS.user_cf_weight,
        DEFAULT_RECOMMENDATION_WEIGHTS.popularity_weight,
        DEFAULT_RECOMMENDATION_WEIGHTS.preference_weight,
        Date.now(),
        'system'
      ]
    )
  }
}

function safeJsonParse(value, fallback) {
  if (!value) {
    return fallback
  }

  if (typeof value === 'object') {
    return value
  }

  try {
    return JSON.parse(value)
  } catch (error) {
    return fallback
  }
}

function parseGenres(rawGenres) {
  const parsed = safeJsonParse(rawGenres, [])
  if (Array.isArray(parsed)) {
    return parsed.map((item) => String(item).trim()).filter(Boolean)
  }
  if (typeof parsed === 'string') {
    return parsed.split(',').map((item) => item.trim()).filter(Boolean)
  }
  return []
}

function normalizePreferences(inputPreferences) {
  const favoriteGenres = Array.isArray(inputPreferences.favoriteGenres)
    ? [...new Set(inputPreferences.favoriteGenres.map((item) => String(item).trim()).filter((item) => GENRE_OPTIONS.includes(item)))].slice(0, 5)
    : []

  const preferredEra = ERA_OPTIONS.has(inputPreferences.preferredEra) ? inputPreferences.preferredEra : 'all'
  const discoveryStyle = STYLE_OPTIONS.has(inputPreferences.discoveryStyle) ? inputPreferences.discoveryStyle : 'balanced'

  return {
    favoriteGenres,
    preferredEra,
    discoveryStyle
  }
}

function getReleaseEra(releaseDate) {
  const year = Number(String(releaseDate || '').slice(0, 4))
  if (!year) {
    return 'all'
  }
  if (year <= 1999) {
    return 'classic'
  }
  if (year <= 2014) {
    return 'millennial'
  }
  return 'recent'
}

function normalizeToUnit(value, maxValue) {
  if (!maxValue || maxValue <= 0) {
    return 0
  }
  return Math.max(0, Math.min(Number(value) / maxValue, 1))
}

function calculatePreferenceScore(movie, preferences) {
  if (!preferences) {
    return 0
  }

  const genres = parseGenres(movie.genres)
  const { favoriteGenres = [], preferredEra = 'all', discoveryStyle = 'balanced' } = preferences
  const matchedGenres = favoriteGenres.filter((genre) => genres.includes(genre)).length
  const genreScore = favoriteGenres.length ? matchedGenres / favoriteGenres.length : 0.35

  const eraScore = preferredEra === 'all' ? 0.6 : Number(getReleaseEra(movie.release_date) === preferredEra)

  const voteScore = normalizeToUnit(Number(movie.vote_average) || 0, 10)
  const popularityScore = normalizeToUnit(Number(movie.popularity) || 0, 100)

  let styleScore = 0.5
  if (discoveryStyle === 'quality') {
    styleScore = voteScore * 0.8 + popularityScore * 0.2
  } else if (discoveryStyle === 'trending') {
    styleScore = popularityScore * 0.8 + voteScore * 0.2
  } else {
    styleScore = voteScore * 0.5 + popularityScore * 0.5
  }

  return Number((genreScore * 0.55 + eraScore * 0.2 + styleScore * 0.25).toFixed(6))
}

function toScoreMap(rows) {
  const scoreMap = new Map()
  rows.forEach((item) => {
    scoreMap.set(item.movie_id, Number(item.total_score) || 0)
  })
  return scoreMap
}

function cosineSimilarityByMap(leftMap, rightMap) {
  let dotProduct = 0
  let leftNorm = 0
  let rightNorm = 0

  leftMap.forEach((value, key) => {
    leftNorm += value * value
    if (rightMap.has(key)) {
      dotProduct += value * rightMap.get(key)
    }
  })

  rightMap.forEach((value) => {
    rightNorm += value * value
  })

  if (!leftNorm || !rightNorm) {
    return 0
  }

  return dotProduct / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm))
}

function calculateItemCfScores(candidateMovieIds, userScoreMap, behaviorRows) {
  const userMovieIds = new Set(userScoreMap.keys())
  const usersByMovie = new Map()
  const movieScoresByUser = new Map()

  behaviorRows.forEach((row) => {
    if (!usersByMovie.has(row.movie_id)) {
      usersByMovie.set(row.movie_id, new Map())
    }
    usersByMovie.get(row.movie_id).set(row.username, Number(row.total_score) || 0)

    if (!movieScoresByUser.has(row.username)) {
      movieScoresByUser.set(row.username, new Map())
    }
    movieScoresByUser.get(row.username).set(row.movie_id, Number(row.total_score) || 0)
  })

  const scores = new Map()

  candidateMovieIds.forEach((candidateId) => {
    const candidateUserMap = usersByMovie.get(candidateId)
    if (!candidateUserMap) {
      scores.set(candidateId, 0)
      return
    }

    let weightedScore = 0
    let weightSum = 0

    userMovieIds.forEach((seenMovieId) => {
      const seenUserMap = usersByMovie.get(seenMovieId)
      if (!seenUserMap) {
        return
      }

      const similarity = cosineSimilarityByMap(candidateUserMap, seenUserMap)
      if (similarity <= 0) {
        return
      }

      const userScore = userScoreMap.get(seenMovieId) || 0
      weightedScore += similarity * userScore
      weightSum += Math.abs(similarity)
    })

    scores.set(candidateId, weightSum > 0 ? weightedScore / weightSum : 0)
  })

  return { scores, movieScoresByUser }
}

function calculateUserCfScores(candidateMovieIds, username, userScoreMap, movieScoresByUser) {
  const similarUsers = []

  movieScoresByUser.forEach((profile, otherUser) => {
    if (otherUser === username) {
      return
    }

    const similarity = cosineSimilarityByMap(userScoreMap, profile)
    if (similarity > 0) {
      similarUsers.push({ similarity, profile })
    }
  })

  similarUsers.sort((a, b) => b.similarity - a.similarity)
  const topUsers = similarUsers.slice(0, 5)
  const scores = new Map()

  candidateMovieIds.forEach((candidateId) => {
    let weightedScore = 0
    let weightSum = 0

    topUsers.forEach((user) => {
      const candidateScore = user.profile.get(candidateId)
      if (candidateScore === undefined) {
        return
      }

      weightedScore += user.similarity * candidateScore
      weightSum += Math.abs(user.similarity)
    })

    scores.set(candidateId, weightSum > 0 ? weightedScore / weightSum : 0)
  })

  return scores
}

function buildNormalizedMap(values) {
  const list = Array.from(values.entries())
  const rawNumbers = list.map(([, value]) => Number(value) || 0)
  const max = Math.max(...rawNumbers, 0)
  const min = Math.min(...rawNumbers, 0)
  const normalized = new Map()

  list.forEach(([key, value]) => {
    const safeValue = Number(value) || 0
    if (max === min) {
      normalized.set(key, safeValue > 0 ? 1 : 0)
      return
    }
    normalized.set(key, (safeValue - min) / (max - min))
  })

  return normalized
}

function normalizeWeightConfig(config) {
  const values = {
    item_cf_weight: Math.max(Number(config.item_cf_weight) || 0, 0),
    user_cf_weight: Math.max(Number(config.user_cf_weight) || 0, 0),
    popularity_weight: Math.max(Number(config.popularity_weight) || 0, 0),
    preference_weight: Math.max(Number(config.preference_weight) || 0, 0)
  }

  const sum = Object.values(values).reduce((total, item) => total + item, 0)
  if (!sum) {
    return { ...DEFAULT_RECOMMENDATION_WEIGHTS }
  }

  return {
    item_cf_weight: values.item_cf_weight / sum,
    user_cf_weight: values.user_cf_weight / sum,
    popularity_weight: values.popularity_weight / sum,
    preference_weight: values.preference_weight / sum
  }
}

function formatUser(user) {
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    role: user.role,
    status: user.status,
    preference_profile: normalizePreferences(safeJsonParse(user.preference_profile, {})),
    created_at: user.created_at
  }
}

async function findUser(username) {
  if (!username) {
    return null
  }
  const rows = await query(
    `
      SELECT id, username, nickname, password_hash, password_salt, role, status, preference_profile, created_at
      FROM users
      WHERE username = ?
      LIMIT 1
    `,
    [username]
  )
  return rows[0] || null
}

async function ensureActiveUser(username) {
  const user = await findUser(username)
  if (!user) {
    return { ok: false, code: 404, message: '用户不存在' }
  }
  if (user.status !== 'active') {
    return { ok: false, code: 403, message: '账号已被禁用，请联系管理员' }
  }
  return { ok: true, user }
}

async function requireAdmin(adminUsername) {
  const result = await ensureActiveUser(adminUsername)
  if (!result.ok) {
    return result
  }
  if (result.user.role !== 'admin') {
    return { ok: false, code: 403, message: '仅管理员可执行此操作' }
  }
  return result
}

async function getRecommendationConfig() {
  const rows = await query('SELECT * FROM recommendation_configs WHERE id = 1 LIMIT 1')
  return rows[0] || { ...DEFAULT_RECOMMENDATION_WEIGHTS, updated_at: 0, updated_by: 'system' }
}

async function writeAdminAuditLog(adminUsername, actionType, targetUsername, actionDetail) {
  await query(
    `
      INSERT INTO admin_audit_logs (admin_username, action_type, target_username, action_detail, created_at)
      VALUES (?, ?, ?, ?, ?)
    `,
    [adminUsername, actionType, targetUsername || null, JSON.stringify(actionDetail || null), Date.now()]
  )
}

function sendError(res, error, fallbackMessage) {
  console.log(error)
  res.send({ code: 500, message: fallbackMessage })
}

db.connect(async (err) => {
  if (err) {
    console.log('数据库连接失败:', err)
    return
  }

  console.log('数据库连接成功')
  try {
    await initUserTable()
    await initMovieExtensionSchema()
  } catch (error) {
    console.log('初始化数据库结构失败:', error)
  }
})

app.get('/api/test', (req, res) => {
  res.json({ msg: 'ok' })
})

app.post('/api/auth/register', async (req, res) => {
  const { username, password, nickname } = req.body || {}

  if (!username || !password) {
    res.send({ code: 400, message: '请填写用户名和密码' })
    return
  }

  if (password.length < 6) {
    res.send({ code: 400, message: '密码至少6位' })
    return
  }

  try {
    const existed = await query('SELECT id FROM users WHERE username = ? LIMIT 1', [username])
    if (existed.length) {
      res.send({ code: 409, message: '用户名已存在' })
      return
    }

    const adminCountRows = await query("SELECT COUNT(*) AS total FROM users WHERE role = 'admin'")
    const role = Number(adminCountRows[0].total) > 0 ? 'user' : 'admin'
    const salt = crypto.randomBytes(16).toString('hex')
    const passwordHash = hashPassword(password, salt)

    await query(
      `
        INSERT INTO users (username, nickname, password_hash, password_salt, role, status, preference_profile, created_at)
        VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
      `,
      [username, nickname || username, passwordHash, salt, role, JSON.stringify(normalizePreferences({})), Date.now()]
    )

    res.send({
      code: 200,
      message: role === 'admin' ? '注册成功，你已成为首位管理员，请继续完善观影偏好' : '注册成功，请继续完善观影偏好'
    })
  } catch (error) {
    sendError(res, error, '注册失败，请稍后重试')
  }
})

app.post('/api/auth/preferences', async (req, res) => {
  const { username, preferences } = req.body || {}

  if (!username) {
    res.send({ code: 400, message: '缺少用户名' })
    return
  }

  const normalizedPreferences = normalizePreferences(preferences || {})
  if (!normalizedPreferences.favoriteGenres.length) {
    res.send({ code: 400, message: '请至少选择一个喜欢的电影类型' })
    return
  }

  try {
    const activeResult = await ensureActiveUser(username)
    if (!activeResult.ok) {
      res.send({ code: activeResult.code, message: activeResult.message })
      return
    }

    await query('UPDATE users SET preference_profile = ? WHERE username = ?', [JSON.stringify(normalizedPreferences), username])
    res.send({ code: 200, message: '偏好设置已保存' })
  } catch (error) {
    sendError(res, error, '保存偏好失败')
  }
})

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {}

  if (!username || !password) {
    res.send({ code: 400, message: '请完整填写登录信息' })
    return
  }

  try {
    const user = await findUser(username)
    if (!user) {
      res.send({ code: 401, message: '用户名或密码错误' })
      return
    }

    if (user.status !== 'active') {
      res.send({ code: 403, message: '账号已被禁用，请联系管理员' })
      return
    }

    const candidateHash = hashPassword(password, user.password_salt)
    if (candidateHash !== user.password_hash) {
      res.send({ code: 401, message: '用户名或密码错误' })
      return
    }

    res.send({
      code: 200,
      message: '登录成功',
      data: {
        username: user.username,
        nickname: user.nickname,
        role: user.role,
        status: user.status,
        preferences: normalizePreferences(safeJsonParse(user.preference_profile, {}))
      }
    })
  } catch (error) {
    sendError(res, error, '登录失败，请稍后重试')
  }
})

app.get('/api/movies', async (req, res) => {
  try {
    const rows = await query(
      `
        SELECT id, chinese_name, poster_path, vote_average, release_date, genres, popularity
        FROM movies
        ORDER BY popularity DESC
        LIMIT 20
      `
    )

    res.send({ code: 200, data: rows })
  } catch (error) {
    sendError(res, error, '获取电影列表失败')
  }
})

app.get('/api/search', async (req, res) => {
  const keyword = req.query.keyword || ''

  try {
    const rows = await query(
      `
        SELECT id, chinese_name, poster_path, vote_average, release_date, genres, popularity
        FROM movies
        WHERE chinese_name LIKE ?
        LIMIT 50
      `,
      [`%${keyword}%`]
    )

    res.send({ code: 200, data: rows })
  } catch (error) {
    sendError(res, error, '搜索失败')
  }
})

app.get('/api/movie', async (req, res) => {
  const id = req.query.id

  try {
    const rows = await query('SELECT * FROM movies WHERE id = ?', [id])
    res.send({ code: 200, data: rows[0] || null })
  } catch (error) {
    sendError(res, error, '获取详情失败')
  }
})

app.post('/api/behavior', async (req, res) => {
  const { username, movie_id: movieId, behavior_type: behaviorType, score } = req.body || {}

  if (!username || !movieId || !behaviorType) {
    res.send({ code: 400, message: '缺少必要参数' })
    return
  }

  const allowedTypes = new Set(['view', 'like', 'favorite'])
  if (!allowedTypes.has(behaviorType)) {
    res.send({ code: 400, message: 'behavior_type不合法' })
    return
  }

  try {
    const activeResult = await ensureActiveUser(username)
    if (!activeResult.ok) {
      res.send({ code: activeResult.code, message: activeResult.message })
      return
    }

    const safeScore = Number(score) > 0 ? Number(score) : 1
    await query(
      `
        INSERT INTO user_movie_behaviors (username, movie_id, behavior_type, score, created_at)
        VALUES (?, ?, ?, ?, ?)
      `,
      [username, movieId, behaviorType, safeScore, Date.now()]
    )

    res.send({ code: 200, message: 'ok' })
  } catch (error) {
    sendError(res, error, '记录行为失败')
  }
})

app.get('/api/recommend', async (req, res) => {
  const username = req.query.username
  const limit = Number(req.query.limit) > 0 ? Number(req.query.limit) : 20

  try {
    const config = normalizeWeightConfig(await getRecommendationConfig())
    const candidateRows = await query(
      `
        SELECT id, chinese_name, poster_path, vote_average, release_date, genres, popularity
        FROM movies
        ORDER BY popularity DESC
        LIMIT 500
      `
    )

    if (!username) {
      const guestRows = candidateRows.map((movie) => ({
        ...movie,
        recommendation_score: Number((normalizeToUnit(Number(movie.popularity) || 0, 100) * 0.65 + normalizeToUnit(Number(movie.vote_average) || 0, 10) * 0.35).toFixed(6))
      }))
      res.send({ code: 200, data: guestRows.slice(0, limit), meta: { mode: 'guest' } })
      return
    }

    const activeResult = await ensureActiveUser(username)
    if (!activeResult.ok) {
      res.send({ code: activeResult.code, message: activeResult.message })
      return
    }

    const userPreferences = normalizePreferences(safeJsonParse(activeResult.user.preference_profile, {}))
    const userBehaviorRows = await query(
      `
        SELECT movie_id, SUM(score) AS total_score
        FROM user_movie_behaviors
        WHERE username = ?
        GROUP BY movie_id
      `,
      [username]
    )

    const seenMovieIds = userBehaviorRows.map((item) => item.movie_id)
    const filteredCandidates = seenMovieIds.length
      ? candidateRows.filter((item) => !seenMovieIds.includes(item.id))
      : candidateRows

    const preferenceMap = new Map()
    const popularityMap = new Map()
    filteredCandidates.forEach((movie) => {
      preferenceMap.set(movie.id, calculatePreferenceScore(movie, userPreferences))
      popularityMap.set(movie.id, Number(movie.popularity) || 0)
    })

    const normalizedPreferenceMap = buildNormalizedMap(preferenceMap)
    const normalizedPopularityMap = buildNormalizedMap(popularityMap)

    if (!userBehaviorRows.length) {
      const ranked = filteredCandidates
        .map((movie) => ({
          id: movie.id,
          chinese_name: movie.chinese_name,
          poster_path: movie.poster_path,
          vote_average: movie.vote_average,
          release_date: movie.release_date,
          genres: movie.genres,
          recommendation_score: Number((
            normalizedPreferenceMap.get(movie.id) * Math.max(config.preference_weight, 0.6) +
            normalizedPopularityMap.get(movie.id) * Math.max(config.popularity_weight, 0.2)
          ).toFixed(6))
        }))
        .sort((a, b) => b.recommendation_score - a.recommendation_score)
        .slice(0, limit)

      res.send({ code: 200, data: ranked, meta: { mode: 'preference-cold-start' } })
      return
    }

    const userScoreMap = toScoreMap(userBehaviorRows)
    const candidateMovieIds = filteredCandidates.map((item) => item.id)
    const behaviorRows = await query(
      `
        SELECT username, movie_id, SUM(score) AS total_score
        FROM user_movie_behaviors
        GROUP BY username, movie_id
      `
    )

    const { scores: itemCfScores, movieScoresByUser } = calculateItemCfScores(candidateMovieIds, userScoreMap, behaviorRows)
    const userCfScores = calculateUserCfScores(candidateMovieIds, username, userScoreMap, movieScoresByUser)
    const normalizedItemMap = buildNormalizedMap(itemCfScores)
    const normalizedUserMap = buildNormalizedMap(userCfScores)

    const ranked = filteredCandidates
      .map((movie) => {
        const finalScore =
          (normalizedItemMap.get(movie.id) || 0) * config.item_cf_weight +
          (normalizedUserMap.get(movie.id) || 0) * config.user_cf_weight +
          (normalizedPopularityMap.get(movie.id) || 0) * config.popularity_weight +
          (normalizedPreferenceMap.get(movie.id) || 0) * config.preference_weight

        return {
          id: movie.id,
          chinese_name: movie.chinese_name,
          poster_path: movie.poster_path,
          vote_average: movie.vote_average,
          release_date: movie.release_date,
          genres: movie.genres,
          recommendation_score: Number(finalScore.toFixed(6))
        }
      })
      .sort((a, b) => b.recommendation_score - a.recommendation_score)
      .slice(0, limit)

    res.send({ code: 200, data: ranked, meta: { mode: 'hybrid' } })
  } catch (error) {
    sendError(res, error, '推荐计算失败')
  }
})

app.get('/api/admin/overview', async (req, res) => {
  const adminUsername = req.query.admin_username

  try {
    const adminResult = await requireAdmin(adminUsername)
    if (!adminResult.ok) {
      res.send({ code: adminResult.code, message: adminResult.message })
      return
    }

    const userCountRows = await query(
      `
        SELECT
          COUNT(*) AS total_users,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_users,
          SUM(CASE WHEN status = 'banned' THEN 1 ELSE 0 END) AS banned_users,
          SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) AS admin_users
        FROM users
      `
    )
    const behaviorRows = await query(
      `
        SELECT behavior_type, COUNT(*) AS total
        FROM user_movie_behaviors
        GROUP BY behavior_type
      `
    )
    const logs = await query(
      `
        SELECT id, admin_username, action_type, target_username, action_detail, created_at
        FROM admin_audit_logs
        ORDER BY created_at DESC
        LIMIT 10
      `
    )

    res.send({
      code: 200,
      data: {
        stats: {
          ...userCountRows[0],
          behavior_summary: behaviorRows
        },
        recent_logs: logs.map((item) => ({
          ...item,
          action_detail: safeJsonParse(item.action_detail, null)
        }))
      }
    })
  } catch (error) {
    sendError(res, error, '获取管理员概览失败')
  }
})

app.get('/api/admin/users', async (req, res) => {
  const adminUsername = req.query.admin_username

  try {
    const adminResult = await requireAdmin(adminUsername)
    if (!adminResult.ok) {
      res.send({ code: adminResult.code, message: adminResult.message })
      return
    }

    const rows = await query(
      `
        SELECT id, username, nickname, role, status, preference_profile, created_at
        FROM users
        ORDER BY created_at DESC
      `
    )

    res.send({ code: 200, data: rows.map(formatUser) })
  } catch (error) {
    sendError(res, error, '获取用户列表失败')
  }
})

app.post('/api/admin/users/status', async (req, res) => {
  const { admin_username: adminUsername, target_username: targetUsername, status } = req.body || {}

  if (!targetUsername || !USER_STATUS.has(status)) {
    res.send({ code: 400, message: '参数不合法' })
    return
  }

  try {
    const adminResult = await requireAdmin(adminUsername)
    if (!adminResult.ok) {
      res.send({ code: adminResult.code, message: adminResult.message })
      return
    }

    if (adminUsername === targetUsername && status === 'banned') {
      res.send({ code: 400, message: '不能封禁当前管理员自己' })
      return
    }

    const targetUser = await findUser(targetUsername)
    if (!targetUser) {
      res.send({ code: 404, message: '目标用户不存在' })
      return
    }

    await query('UPDATE users SET status = ? WHERE username = ?', [status, targetUsername])
    await writeAdminAuditLog(adminUsername, 'update_user_status', targetUsername, { status })
    res.send({ code: 200, message: status === 'banned' ? '封号成功' : '已恢复账号' })
  } catch (error) {
    sendError(res, error, '更新用户状态失败')
  }
})

app.post('/api/admin/users/role', async (req, res) => {
  const { admin_username: adminUsername, target_username: targetUsername, role } = req.body || {}

  if (!targetUsername || !USER_ROLES.has(role)) {
    res.send({ code: 400, message: '参数不合法' })
    return
  }

  try {
    const adminResult = await requireAdmin(adminUsername)
    if (!adminResult.ok) {
      res.send({ code: adminResult.code, message: adminResult.message })
      return
    }

    const targetUser = await findUser(targetUsername)
    if (!targetUser) {
      res.send({ code: 404, message: '目标用户不存在' })
      return
    }

    if (adminUsername === targetUsername && role !== 'admin') {
      res.send({ code: 400, message: '不能移除当前管理员自己的管理员身份' })
      return
    }

    await query('UPDATE users SET role = ? WHERE username = ?', [role, targetUsername])
    await writeAdminAuditLog(adminUsername, 'update_user_role', targetUsername, { role })
    res.send({ code: 200, message: role === 'admin' ? '已授予管理员权限' : '已取消管理员权限' })
  } catch (error) {
    sendError(res, error, '更新用户角色失败')
  }
})

app.get('/api/admin/recommendation-config', async (req, res) => {
  const adminUsername = req.query.admin_username

  try {
    const adminResult = await requireAdmin(adminUsername)
    if (!adminResult.ok) {
      res.send({ code: adminResult.code, message: adminResult.message })
      return
    }

    const config = await getRecommendationConfig()
    res.send({
      code: 200,
      data: {
        ...config,
        normalized: normalizeWeightConfig(config)
      }
    })
  } catch (error) {
    sendError(res, error, '获取推荐配置失败')
  }
})

app.post('/api/admin/recommendation-config', async (req, res) => {
  const {
    admin_username: adminUsername,
    item_cf_weight: itemCfWeight,
    user_cf_weight: userCfWeight,
    popularity_weight: popularityWeight,
    preference_weight: preferenceWeight
  } = req.body || {}

  const nextConfig = {
    item_cf_weight: Number(itemCfWeight),
    user_cf_weight: Number(userCfWeight),
    popularity_weight: Number(popularityWeight),
    preference_weight: Number(preferenceWeight)
  }

  const invalid = Object.values(nextConfig).some((item) => Number.isNaN(item) || item < 0)
  if (invalid) {
    res.send({ code: 400, message: '推荐权重必须是大于等于0的数字' })
    return
  }

  try {
    const adminResult = await requireAdmin(adminUsername)
    if (!adminResult.ok) {
      res.send({ code: adminResult.code, message: adminResult.message })
      return
    }

    await query(
      `
        UPDATE recommendation_configs
        SET item_cf_weight = ?, user_cf_weight = ?, popularity_weight = ?, preference_weight = ?, updated_at = ?, updated_by = ?
        WHERE id = 1
      `,
      [
        nextConfig.item_cf_weight,
        nextConfig.user_cf_weight,
        nextConfig.popularity_weight,
        nextConfig.preference_weight,
        Date.now(),
        adminUsername
      ]
    )

    await writeAdminAuditLog(adminUsername, 'update_recommendation_weight', null, nextConfig)
    res.send({ code: 200, message: '推荐算法权重已更新' })
  } catch (error) {
    sendError(res, error, '更新推荐配置失败')
  }
})

app.listen(3000, () => {
  console.log('API已启动 http://localhost:3000')
})
