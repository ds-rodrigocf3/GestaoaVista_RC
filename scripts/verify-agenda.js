const sql = require('mssql');
require('dotenv').config();

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE || process.env.LOCAL_DB_NAME || process.env.DB_NAME,
    server: process.env.DB_SERVER || process.env.LOCAL_DB_SERVER || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || 1433),
    options: {
        encrypt: true,
        trustServerCertificate: true,
        useUTC: false
    }
};

async function verify() {
    try {
        const pool = await sql.connect(config);
        console.log('✅ Connected to DB');

        // 1. Insert multi-day event
        const startDate = new Date();
        startDate.setDate(startDate.getDate() + 2); // 2 days from now
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 4); // 4 days from now

        console.log('Inserting multi-day Workshop event...');
        await pool.request()
            .input('Tit', sql.NVARCHAR, 'Workshop de Inovação UX')
            .input('Start', sql.DATETIME, startDate)
            .input('End', sql.DATETIME, endDate)
            .input('Tipo', sql.NVARCHAR, 'Workshop')
            .query('INSERT INTO BI_Eventos (Titulo, DataInicio, DataFim, Tipo) VALUES (@Tit, @Start, @End, @Tipo)');

        // 2. Insert multi-day absence for a user
        console.log('Fetching a collaborator...');
        const colabResult = await pool.request().query('SELECT TOP 1 Id FROM BI_Colaboradores WHERE Ativo = 1');
        if (colabResult.recordset.length > 0) {
            const empId = colabResult.recordset[0].Id;
            const vacStart = new Date();
            vacStart.setDate(vacStart.getDate() + 5);
            const vacEnd = new Date();
            vacEnd.setDate(vacEnd.getDate() + 15);

            console.log(`Inserting multi-day Férias for empId ${empId}...`);
            await pool.request()
                .input('EmpId', sql.INT, empId)
                .input('Start', sql.DATE, vacStart)
                .input('End', sql.DATE, vacEnd)
                .input('Type', sql.NVARCHAR, 'Férias integrais')
                .input('Status', sql.NVARCHAR, 'Aprovado')
                .query('INSERT INTO Requests (EmployeeId, Type, StartDate, EndDate, Status, Priority) VALUES (@EmpId, @Type, @Start, @End, @Status, \'Baixa\')');
        }

        console.log('✅ Test data inserted successfully!');
        await pool.close();
    } catch (err) {
        console.error('❌ Error:', err);
    }
}

verify();
