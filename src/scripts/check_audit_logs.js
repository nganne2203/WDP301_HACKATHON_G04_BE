import { CONNECT_DB, CLOSE_DB } from '#configs/mongodb.js'
import mongoose from 'mongoose'
import '#models/auditLog.model.js'

async function main() {
  await CONNECT_DB()
  try {
    const logs = await mongoose.model('AuditLog').find({}).sort({ createdAt: -1 }).limit(10)
    console.log('LATEST AUDIT LOGS:')
    for (const log of logs) {
      console.log(`- Action: ${log.action}, Result: ${log.result}, Msg: ${log.errorMessage || 'none'}`);
      if (log.metadata) {
        console.log(`  Metadata:`, JSON.stringify(log.metadata));
      }
    }
  } catch (error) {
    console.error(error)
  } finally {
    await CLOSE_DB()
    process.exit(0)
  }
}
main()
