const sql = require('mssql');
require('dotenv').config();

const serverAddressRaw = process.env.DB_SERVER || process.env.LOCAL_DB_SERVER || '127.0.0.1';
const serverAddress = serverAddressRaw.split('\\')[0];

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE || process.env.LOCAL_DB_NAME || process.env.DB_NAME,
    server: serverAddress,
    port: parseInt(process.env.DB_PORT || 1433),
    options: {
        encrypt: true,
        trustServerCertificate: true,
        useUTC: false
    }
};

async function testManagerAutoApproval() {
    try {
        const pool = await sql.connect(config);
        console.log('✅ Connected');

        const managerId = 2; // Aline
        const subordinateId = 3; // Fernando
        const pastDate = '2026-04-10'; // A past date relative to 2026-04-21

        console.log(`Simulating Manager (${managerId}) setting scale for Subordinate (${subordinateId}) on ${pastDate}...`);
        
        // This simulates the logic in POST /api/requests
        // 1. Verify manager relationship
        const colabRes = await pool.request().input('Id', sql.INT, subordinateId).query('SELECT GestorId FROM BI_Colaboradores WHERE Id = @Id');
        const gestorId = colabRes.recordset[0].GestorId;
        
        if (gestorId === managerId) {
            console.log('✅ Manager relationship confirmed.');
            
            // 2. Insert as Aprovado
            const res = await pool.request()
                .input('Emp', sql.INT, subordinateId)
                .input('Date', sql.DATE, pastDate)
                .input('Loc', sql.NVARCHAR, 'Presencial')
                .query(`
                    INSERT INTO Requests (EmployeeId, Type, Status, StartDate, EndDate, LocalTrabalho, Note)
                    VALUES (@Emp, 'Ajuste de Escala', 'Aprovado', @Date, @Date, @Loc, 'Teste Auto-Approve')
                `);
            
            console.log('✅ Adjustment Request inserted as Aprovado.');

            // 3. Trigger sync logic (same as in server.js)
            console.log('Synchronizing with scale...');
            await pool.request()
                .input('Emp', sql.INT, subordinateId)
                .input('Date', sql.DATE, pastDate)
                .input('Loc', sql.NVARCHAR, 'Presencial')
                .query(`
                    IF EXISTS (SELECT 1 FROM Requests WHERE EmployeeId=@Emp AND Type='Escala de Trabalho' AND StartDate=@Date)
                      UPDATE Requests SET LocalTrabalho=@Loc, Status='Aprovado', DataModificacao=GETDATE() 
                      WHERE EmployeeId=@Emp AND Type='Escala de Trabalho' AND StartDate=@Date
                    ELSE 
                      INSERT INTO Requests (EmployeeId, Type, Status, StartDate, EndDate, LocalTrabalho, DataCriacao, DataModificacao)
                      VALUES (@Emp, 'Escala de Trabalho', 'Aprovado', @Date, @Date, @Loc, GETDATE(), GETDATE())
                `);
            
            console.log('✅ Scale sync completed.');

            // 4. Verify results
            const final = await pool.request()
                .input('Emp', sql.INT, subordinateId)
                .input('Date', sql.DATE, pastDate)
                .query("SELECT Type, Status, LocalTrabalho FROM Requests WHERE EmployeeId=@Emp AND StartDate=@Date");
            
            console.log('Final Database State for that day:');
            console.log(JSON.stringify(final.recordset, null, 2));

        } else {
            console.error('❌ Manager relationship check failed.');
        }

        await pool.close();
    } catch (err) {
        console.error(err);
    }
}

testManagerAutoApproval();
