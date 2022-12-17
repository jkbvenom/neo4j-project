// express server initialization
const express = require('express')
const app = express()
const bcrypt = require('bcryptjs')

// env vars and body parser
app.use(express.json())
require('dotenv').config()

// third-party packages
const colors = require('colors')

// driver session
const { initDriver, getDriver } = require('./neo4j')
const { errorHandler, notFound } = require('./middlewares/errorHandler')
const driver = getDriver()
const session = driver.session({database: 'neo4j'})

// API routes

// Create User
app.use('/api/v1/auth/register', async(req, res) => {
    let {username, email, password} = req.body

    const salt = await bcrypt.genSalt(10)
    password = await bcrypt.hash(password, salt)

    const newUser = await session.executeWrite(tx => {
        return tx.run(
          `
            MERGE (u: User {email: $email})
            SET u.username = $username
            SET u.password = $password
          `, {
            username,
            email,
            password,
          }
        )
    })

    if (newUser) {
        res.status(200).json({ username, email })
    } else {
        res.status(400)
        throw new Error('User was not created')
    }
})

// Log In
app.use('/api/v1/auth/login', async(req, res) => {
    let {email, password} = req.body

    const salt = await bcrypt.genSalt(10)
    password = await bcrypt.hash(password, salt)

    const userNode = await session.executeRead(tx => {
        return tx.run(
          `
          MATCH (u: User)
            WHERE u.email = $email
            RETURN u.password
          `, {
            email,
          }
        )
    })

    if (userNode.records.length > 0) {
        res.status(200).json({ email })
    } else {
        res.status(401)
        throw new Error('Wrong user credentials')
    }
})

// error handling
app.use(errorHandler)
app.use(notFound)

// server
const PORT = process.env.PORT || 5000

const start = async() => {
   try {
    await initDriver('neo4j://localhost:7687')
    console.log(colors.underline.bold.cyan('Neo4j connected successfully'))
    app.listen(PORT, () => {
        console.log(colors.yellow.underline.bold(`Server listening in ${process.env.NEO4J_ENV} mode on port ${PORT}...`))
    })

    return driver
} catch (error) {
    console.log(colors.underline.bold.red(`Error: ${error}`))
   }
}

start()
