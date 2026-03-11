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

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, HASH_ITERATIONS, HASH_KEY_LENGTH, HASH_DIGEST).toString('hex')
}

// 数据库连接
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '123123lzy',
  database: 'movie_db'
})

// 连接数据库
db.connect((err) => {
  if (err) {
    console.log('数据库连接失败:', err)
  } else {
    console.log('数据库连接成功')
    initUserTable()
  }
})

function initUserTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS users (
      id INT PRIMARY KEY AUTO_INCREMENT,
      username VARCHAR(50) NOT NULL UNIQUE,
      nickname VARCHAR(50) NOT NULL,
      password_hash VARCHAR(128) NOT NULL,
      password_salt VARCHAR(32) NOT NULL,
      created_at BIGINT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `

  db.query(sql, (err) => {
    if (err) {
      console.log('初始化用户表失败:', err)
    }
  })
}

// 测试接口
app.get('/api/test', (req, res) => {
  res.json({ msg: 'ok' })
})

// 注册
app.post('/api/auth/register', (req, res) => {
  const { username, password, nickname } = req.body || {}

  if (!username || !password) {
    res.send({ code: 400, message: '请填写用户名和密码' })
    return
  }

  if (password.length < 6) {
    res.send({ code: 400, message: '密码至少6位' })
    return
  }

  const findSql = 'SELECT id FROM users WHERE username = ? LIMIT 1'
  db.query(findSql, [username], (findErr, findResult) => {
    if (findErr) {
      console.log(findErr)
      res.send({ code: 500, message: '注册失败，请稍后重试' })
      return
    }

    if (findResult.length) {
      res.send({ code: 409, message: '用户名已存在' })
      return
    }

    const salt = crypto.randomBytes(16).toString('hex')
    const passwordHash = hashPassword(password, salt)

    const insertSql = `
      INSERT INTO users (username, nickname, password_hash, password_salt, created_at)
      VALUES (?, ?, ?, ?, ?)
    `

    db.query(
      insertSql,
      [username, nickname || username, passwordHash, salt, Date.now()],
      (insertErr) => {
        if (insertErr) {
          console.log(insertErr)
          res.send({ code: 500, message: '注册失败，请稍后重试' })
          return
        }

        res.send({ code: 200, message: '注册成功，请登录' })
      }
    )
  })
})

// 登录
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {}

  if (!username || !password) {
    res.send({ code: 400, message: '请完整填写登录信息' })
    return
  }

  const sql = `
    SELECT username, nickname, password_hash, password_salt
    FROM users
    WHERE username = ?
    LIMIT 1
  `

  db.query(sql, [username], (err, result) => {
    if (err) {
      console.log(err)
      res.send({ code: 500, message: '登录失败，请稍后重试' })
      return
    }

    const user = result[0]
    if (!user) {
      res.send({ code: 401, message: '用户名或密码错误' })
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
        nickname: user.nickname
      }
    })
  })
})

// =====================
// 获取首页电影（前20条）
// =====================
app.get('/api/movies', (req, res) => {
  const sql = `
        SELECT
            id,
            chinese_name,
            poster_path,
            vote_average,
            release_date
        FROM movies
        ORDER BY popularity DESC
        LIMIT 20
    `

  db.query(sql, (err, result) => {
    if (err) {
      console.log(err)
      res.send({ code: 500 })
    } else {
      res.send({
        code: 200,
        data: result
      })
    }
  })
})

// =====================
// 搜索电影
// =====================
app.get('/api/search', (req, res) => {
  const keyword = req.query.keyword

  const sql = `
        SELECT
            id,
            chinese_name,
            poster_path,
            vote_average,
            release_date
        FROM movies
        WHERE chinese_name LIKE ?
        LIMIT 50
    `

  db.query(sql, [`%${keyword}%`], (err, result) => {
    if (err) {
      console.log(err)
      res.send({ code: 500 })
    } else {
      res.send({
        code: 200,
        data: result
      })
    }
  })
})

// =====================
// 电影详情
// =====================
app.get('/api/movie', (req, res) => {
  const id = req.query.id

  const sql = `
        SELECT *
        FROM movies
        WHERE id = ?
    `

  db.query(sql, [id], (err, result) => {
    if (err) {
      console.log(err)
      res.send({ code: 500 })
    } else {
      res.send({
        code: 200,
        data: result[0]
      })
    }
  })
})

app.listen(3000, () => {
  console.log('API已启动 http://localhost:3000')
})
