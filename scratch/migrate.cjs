const { getTenantPool, controlPool } = require('./db');
async function run() {
  const [tenants] = await controlPool.query('SELECT slug, db_schema FROM tenants WHERE activo=1');
  for (const t of tenants) {
    const pool = getTenantPool(t.db_schema);
    const [rpTables] = await pool.query("SHOW TABLES LIKE 'roles_permisos'");
    if (rpTables.length === 0) {
      await pool.query(`
        CREATE TABLE roles_permisos (
          rolId INT NOT NULL,
          ruta VARCHAR(100) NOT NULL,
          PRIMARY KEY (rolId, ruta),
          CONSTRAINT roles_permisos_ibfk_1 FOREIGN KEY (rolId) REFERENCES roles (id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
      `);
      await pool.query(`
        INSERT IGNORE INTO roles_permisos (rolId, ruta) VALUES
        (1, '/dashboard'), (1, '/mesas'), (1, '/delivery'), (1, '/pedidos'), (1, '/productos'), (1, '/categorias'), (1, '/clientes'), (1, '/facturacion'), (1, '/usuarios'), (1, '/metodos-pago'), (1, '/reportes'), (1, '/configuracion'),
        (2, '/mesas'), (2, '/delivery'), (2, '/pedidos'), (2, '/clientes'),
        (3, '/cocina'),
        (4, '/delivery'), (4, '/pedidos'), (4, '/facturacion')
      `);
      console.log('Migrated', t.db_schema);
    } else {
      console.log('Already migrated', t.db_schema);
    }
  }
  process.exit(0);
}
run();
