const path = require('path');
const { getTenantPool, controlPool } = require('../../restaurant_web_api/db');

async function run() {
  try {
    const [tenants] = await controlPool.query('SELECT slug, db_schema FROM tenants WHERE activo=1');
    for (const t of tenants) {
      const pool = getTenantPool(t.db_schema);
      await pool.query("INSERT IGNORE INTO roles_permisos (rolId, ruta) VALUES (1, '/roles'), (1, '/cocina')");
      console.log('✅ Permiso /roles agregado al rol Admin en DB:', t.db_schema);
    }
  } catch (err) {
    console.error('Error al migrar:', err);
  } finally {
    process.exit(0);
  }
}

run();
