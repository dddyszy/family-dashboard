import { env } from '../env'
import { openDatabase, runMigrations } from './client'

const { db, sqlite } = openDatabase(env.dbPath)
runMigrations(db)
sqlite.close()
console.log(`数据库迁移完成：${env.dbPath}`)
