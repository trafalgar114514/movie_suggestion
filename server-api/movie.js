const express = require('express')
const mysql = require('mysql2')
const cors = require('cors')

const app = express()
app.use(cors())

// 数据库连接
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '123123lzy',
    database: 'movie_db'
})

// 连接数据库
db.connect(err => {
    if (err) {
        console.log('数据库连接失败:', err)
    } else {
        console.log('数据库连接成功')
    }
})

// 测试接口
app.get('/api/test', (req, res) => {
    res.json({ msg: 'ok' })
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