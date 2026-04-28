require('dotenv').config();
const { poolPromise, sql } = require('../src/config/database');

async function migrate() {
    try {
        const pool = await poolPromise;
        console.log('Migrating Requests table to add ComentarioAprovacao...');
        
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.columns 
                           WHERE object_id = OBJECT_ID('Requests') 
                           AND name = 'ComentarioAprovacao')
            BEGIN
                ALTER TABLE Requests ADD ComentarioAprovacao NVARCHAR(1000) NULL;
                PRINT 'Column ComentarioAprovacao added to Requests table.';
            END
            ELSE
            BEGIN
                PRINT 'Column ComentarioAprovacao already exists.';
            END
        `);
        
        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
